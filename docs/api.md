# 云函数接口规范（简要）

本文档列出项目初期需要实现的 5 个核心云函数接口：

- `wechatLogin`
- `checkCommunity`
- `getBindingInfo`
- `submitBinding`
- `validateToken`

为每个接口给出：功能说明、请求示例、响应示例、常见错误码与权限说明、实现提示。

---

## 1. wechatLogin

- 功能：使用前端提供的 `code`（wx.login 返回）向云函数换取会话/openid（在 mock 情况下可直接生成），创建或更新用户记录，返回 token 与用户绑定状态（bindingStatus）。
- 权限：公共（小程序端可直接调用）。

请求示例

```
{
  "code": "xxx",
  "encryptedData": "...", // 可选，用于获取手机号等
  "iv": "..." // 可选
}
```

成功响应示例

```
{
  "success": true,
  "token": "token_abc123",
  "userInfo": { "nickname": "张三", "avatarUrl": "..." },
  "bindingStatus": "none", // one of: none|pending|failed|approved
  "bindInfo": null, // 当有已提交的 bindInfo 时返回
  "failReason": null
}
```

失败响应示例

```
{ "success": false, "code": 1001, "message": "code 无效或换取 session 失败" }
```

错误码

- 1000 参数错误
- 1001 登录失败 / code 无效
- 1002 云端内部错误

实现提示

- 在真实实现中，使用微信 openid/unionid 识别用户并创建 `users` 文档，会返回或签发一个短期 token（可选）。
- 返回的 `bindingStatus` 应根据 `bindings` 集合中该用户的最新记录确定：
  - 若无记录 -> `none`
  - 若存在 status='pending' -> `pending`
  - 若存在 status='failed' -> `failed`，同时返回 `failReason` 和 `bindInfo`
  - 若存在 status='approved' -> `approved`

---

## 2. checkCommunity

- 功能：检查给定小区名是否在 `communities` 集合中已注册，支持模糊或精确匹配（实现可选）。
- 权限：公共（前端调用）。

请求示例

```
{ "name": "和平小区" }
```

成功响应示例

```
{ "registered": true, "communityId": "c_001", "candidates": [{"id":"c_001","name":"和平小区"}] }
```

未注册示例

```
{ "registered": false, "candidates": [] }
```

错误码

- 1000 参数错误
- 1003 查询失败

实现提示

- 推荐支持模糊搜索并返回候选列表以提升用户体验。若匹配到唯一社区，可返回 `communityId` 以便后续写入 `bindings` 时引用。

---

## 3. getBindingInfo

- 功能：获取当前登录用户的绑定记录（最新一条），用于决定前端跳转（bind-info 页面展示）。
- 权限：需要身份（token）或在云函数环境中使用上下文（推荐使用云函数上下文或 token 校验）。

请求示例

```
{} // 若使用云上下文识别 user
```

成功响应示例

```
{
  "exists": true,
  "info": {
    "communityName": "和平小区",
    "region": ["广东省","深圳市","南山区"],
    "building": "A座",
    "block": "1单元",
    "room": "101"
  },
  "status": "pending", // none|pending|failed|approved
  "failReason": null
}
```

未提交示例

```
{ "exists": false }
```

错误码

- 1000 参数错误
- 1004 未授权或 token 无效
- 1005 查询失败

实现提示

- 使用云函数上下文（`event` / `context`）或 token 校验拿到 `userId`，再从 `bindings` 中查询该 `userId` 的最新记录。

---

## 4. submitBinding

- 功能：接受前端提交的绑定信息（region, communityName, building, block, room），做幂等写入（创建或更新用户的 binding），并将状态设为 `pending`，返回 bindingId 与状态。
- 权限：需要身份（token）或云上下文；前端写入应通过云函数完成以保证校验与权限。

请求示例

```
{
  "info": {
    "region": ["广东省","深圳市","南山区"],
    "communityName": "和平小区",
    "building": "A座",
    "block": "1单元",
    "room": "101"
  }
}
```

成功响应示例

```
{ "success": true, "bindingId": "b_123", "status": "pending" }
```

失败示例

```
{ "success": false, "code": 2001, "message": "重复提交或数据不合法" }
```

错误码

- 2000 DB 写入失败
- 2001 提交重复或冲突（例如已存在 pending）
- 2002 参数校验失败

实现提示

- 幂等策略：先查询当前 userId 是否已有未完成（pending）的 binding，若存在可返回现有 bindingId 或拒绝重复提交；也可采用 upsert（先查后写）。
- 写入应记录 submittedAt，并置 status='pending'。
- 后端应对 communityName 做一次 `checkCommunity`（可模糊匹配或验证 communityId）。

---

## 5. validateToken

- 功能：校验前端持有的 token 是否有效（用于 App 启动时检查登录状态）。
- 权限：公共（供小程序端调用）。

请求示例

```
{ "token": "token_abc123" }
```

成功响应示例

```
{ "valid": true, "userInfo": { "_id": "u_001", "nickname": "张三" } }
```

无效 token 示例

```
{ "valid": false }
```

错误码

- 1000 参数错误
- 1004 未授权
- 1006 token 服务异常

实现提示

- token 的结构与签发方式可由你决定（JWT、简单随机字符串 + 存 DB 等）。
- 若使用云开发环境自带 session（如 openid），可直接以 openid 关联用户并返回有效性。

---

## 通用错误码与建议

- 1000 参数错误（missing/invalid）
- 1001 登录 / code 换取失败
- 1003 查询失败（数据库读）
- 1004 未授权 / token 无效
- 2000 写入失败（数据库写）
- 2001 幂等冲突 / 重复提交
- 3000 内部错误（catch-all）

实现建议汇总

- 前端与后端先约定好请求/响应格式（尽量稳定），并把示例放在 `docs/api.md`。前端可以先接 mock 云函数，mock 必须遵循同一格式。
- 所有写操作（submitBinding）应通过云函数执行，前端不直接写 DB。
- 所有云函数要做好输入校验与异常捕获，并在日志中记录关键字段（不要记录敏感信息）。

---

如果你确认这个合约，我可以接着：

- 在 `cloudfunctions/` 里创建零依赖的 mock 云函数实现（支持 wechatLogin 的多种返回场景），并把它们部署/放好以便前端直接调用；或
- 先把本文件加入 `docs/api.md`（已完成），你可修改接口细节后让我生成 mock 实现。

（文档结束）
