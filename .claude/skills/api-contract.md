# api-contract

API 接口契约规范。覆盖 REST API（Express → 管理前端）和云函数调用（小程序/Express → 云函数）两套调用链路。

## 一、REST API 契约（Express 后端 → 管理前端）

### 1.1 URL 命名
```
GET    /api/资源复数              # 列表
GET    /api/资源复数/:id          # 详情
POST   /api/资源复数              # 创建
PUT    /api/资源复数/:id          # 全量更新
PATCH  /api/资源复数/:id          # 部分更新
DELETE /api/资源复数/:id          # 删除
```

示例：
```
GET  /api/repairs?page=1&pageSize=20&communityId=xxx
POST /api/repairs
PUT  /api/repairs/:id
```

### 1.2 请求参数

分页：`{ page: number, pageSize: number }`（page 从 1 开始）
排序：`{ sortBy: string, sortOrder: 'asc' | 'desc' }`
筛选：查询参数中的业务字段

### 1.3 响应格式

**列表**：
```json
{
  "success": true,
  "data": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

**单条/操作**：
```json
{ "success": true, "data": { "_id": "...", ... } }
{ "success": true }
```

**错误**：
```json
{ "success": false, "error": "error_code_string" }
```

### 1.4 错误码枚举

| 错误码 | HTTP 状态码 | 说明 |
|--------|-----------|------|
| `token_missing` | 401 | 缺少认证 token |
| `token_invalid` | 401 | token 无效或已过期 |
| `token_expired` | 401 | token 已过期 |
| `insufficient_permissions` | 403 | 权限不足 |
| `community_expired` | 403 | 小区服务已到期 |
| `validation_error` | 400 | 参数校验失败 |
| `missing_params` | 400 | 缺少必要参数 |
| `resource_not_found` | 404 | 资源不存在 |
| `resource_conflict` | 409 | 资源冲突（如重复创建） |
| `internal_error` | 500 | 服务器内部错误 |
| `service_unavailable` | 503 | 服务暂不可用 |

## 二、云函数调用契约（小程序/Express → 云函数）

### 2.1 调用方式
```javascript
// 小程序
const res = await wx.cloud.callFunction({ name: "functionName", data: { ... } });

// Express 后端（通过 tcb.callFunction 代理）
const callRes = await tcb.callFunction({ name: "functionName", data: { ... } });
```

### 2.2 入参规范

- `data` 对象中的字段使用 **camelCase**
- 分页参数与 REST API 保持一致：`{ page, pageSize }`
- 携带 admin token 时使用 `data.adminToken`

### 2.3 出参规范（全项目统一）🔴

```json
// 成功
{ "success": true }
{ "success": true, "data": { ... } }
{ "success": true, "data": [...], "total": 100 }

// 失败
{ "success": false, "error": "描述性错误信息" }
```

**禁止在返回值中包含**：
- `errorDetail` — 会泄露调用栈
- `rawData` — 会泄露第三方 API 响应
- `stack` — 会泄露服务端路径
- `err.message` — 会泄露 SDK 内部错误信息

### 2.4 过渡期兼容处理

由于当前云函数存在三套返回格式，调用方必须兼容：
```javascript
const result = res.result || {};
const isSuccess = result.success !== undefined
  ? result.success          // Convention A/C
  : result.code === 0;      // Convention B

if (isSuccess) {
  // 处理成功
} else {
  const errorMsg = result.error || result.message || "操作失败";
  // 处理失败
}
```

新开发的云函数**严格使用 Convention A**（`success`/`error`）。旧函数修改时同步迁移。

## 三、接口文档同步

- 新增/修改 REST API 后必须更新 `docs/api.md`
- 新增/修改云函数参数后，在函数目录下创建/更新 `README.md`：
  ```
  cloudfunctions/createVote/README.md
  ```
- README 内容：入参说明、出参说明、调用示例

## 四、版本管理

- API 不支持多版本并存（当前项目规模不需要）
- 破坏性变更：新增字段（向前兼容）`✅`，删除/重命名字段 `❌`（需协调所有调用方同步上线）
