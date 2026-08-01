# security-coding

安全编码规范。覆盖认证授权、输入验证、多租户隔离、隐私保护、接口安全五大领域。适用于所有端的代码安全审查和开发。

> 🔴 物业服务系统处理业主身份证、手机号、房产证等敏感信息。本规范为强制性规范，不可降级。

---

## 一、认证与授权

### 1.1 Express 后端
- 每个受保护路由**必须**通过 `authMiddleware`
- 社区管理员（`community`/`community_admin`）只能操作 `req.user.communityId` 范围内的数据
- URL 路径参数中的资源 ID 需校验归属 — **禁止**像 `announcement.js` 那样接受任意 `communityId`
- 密码存储使用 **bcrypt**，禁止裸 SHA-256
- Token 使用 `crypto.randomBytes(32).toString('hex')` 生成，并设置过期时间
- 敏感操作（修改权限、删除数据、导出）需二次校验用户身份

### 1.2 云函数
- 用户身份统一通过 `cloud.getWXContext().OPENID` 获取
- Admin 调用的云函数：接收 `event.adminToken`，信任调用链路的 `server.js` 已完成校验
- **禁止**在云函数代码中硬编码 token、密码、密钥

### 1.3 前端
- Token 存储：当前 `localStorage` 存 token 有 XSS 风险，后续迁移到 `httpOnly` cookie
- 路由守卫：`router.beforeEach` 已实现基础校验，需保持

---

## 二、输入验证与防注入

### 2.1 Express 后端
- 所有输入通过 `validate` 中间件校验类型、格式、范围（Stage 2 后可用）
- **禁止**对数据库查询使用字符串拼接构造条件
- `db.RegExp` 需防范 ReDoS（正则表达式拒绝服务攻击）— 限制正则长度和复杂度

### 2.2 云函数
- `event` 中的所有参数在函数体第一段校验
- 手机号：`/^1[3-9]\d{9}$/`
- 分页参数：`page` 最小 1，`pageSize` 最大 100
- 枚举参数：使用白名单校验，如 `type in ['vote', 'survey']`

### 2.3 前端
- 表单提交前做前端校验（格式、长度、必填）
- **禁止**用 `v-html` 渲染任何用户输入的内容，必须用 `{{ }}` 插值（自带转义）

---

## 三、多租户隔离 🔴 [物业行业强制]

### 3.1 数据查询
```javascript
// ✅ 所有社区数据查询必须过滤 communityId
db.collection("votes").where({
  communityId: user.communityId,   // ← 必须
  ...otherFilters
}).get();

// ❌ 越权 — 信任用户传入的参数
db.collection("votes").where({
  communityId: req.query.communityId  // ← 可通过 URL 篡改
}).get();
```

### 3.2 文件隔离
- 文件上传时记录 `communityId` 和 `uploadedBy`
- 文件访问时校验请求者是否属于该文件所属社区

### 3.3 门禁设备隔离
- 门禁操作需校验：设备 `communityId` === 用户 `communityId`
- 单元门禁额外校验：设备归属单元 === 用户认证的单元

---

## 四、隐私数据保护 🔴 [物业行业强制]

### 4.1 展示脱敏（前端必须）

| 数据类型 | 脱敏规则 | 示例 |
|---------|---------|------|
| 手机号 | 前3后4，中间4位掩码 | `138****1234` |
| 身份证号 | 前4后4，中间10位掩码 | `3301**********1234` |
| 姓名 | 保留首字，其余掩码 | `张**` 或 `张***` |
| 详细地址 | 默认只显示到小区/楼栋级 | 完整地址需授权查看 |

### 4.2 日志脱敏

```javascript
// ❌ 禁止
console.log("用户手机:", phone);        // 明文
console.log("身份证号:", idCard);       // 明文

// ✅ 正确
console.log("用户手机:", phone.slice(0,3) + "****" + phone.slice(7));
console.log("身份证号:", idCard.slice(0,4) + "****" + idCard.slice(-4));
```

### 4.3 存储
- 身份证图片不存储 OCR 的 `rawData` 调试字段
- 用户注销时：个人身份信息（手机号、身份证图片）**物理删除**
- 用户注销时：业务数据（投票记录等）**匿名化保留**（移除 openid 关联）

### 4.4 审计
- 查看完整隐私数据 → 记录 `{ userId, action: "view_full_phone", targetUserId, timestamp }`
- 数据导出 → 二次确认 + 记录 `{ userId, action: "export_data", scope, count, timestamp }`
- 审计日志写入 `audit_logs` 集合

---

## 五、接口安全

### 5.1 速率限制（待引入）
- 登录接口：10 次/分钟/IP
- 通用 API：100 次/分钟/IP
- 门禁开门接口：30 次/分钟/设备

### 5.2 安全头（待引入）
- `helmet` 中间件：CSP、X-Frame-Options、X-Content-Type-Options 等

### 5.3 文件上传
- 类型白名单：仅允许 `image/jpeg`, `image/png`, `application/pdf`
- 大小限制：单文件 ≤ 5MB
- 文件名：重命名为 UUID，防止路径遍历攻击

### 5.4 门禁安全
- 开门接口 `/door/open-from-cloud` 使用独立密钥 `DOOR_CLOUD_ACCESS_KEY`
- 不通过常规 token 认证，防止 token 泄露导致远程开门

---

## 六、安全检查清单

新功能上线前，逐项确认：

- [ ] 所有数据库查询是否过滤了 `communityId`？
- [ ] 前端展示是否对手机号/身份证号做了脱敏？
- [ ] 日志中是否避免打印隐私数据明文？
- [ ] 路由是否有 `authMiddleware` 保护？（除公开接口外）
- [ ] 输入参数是否有 schema 校验？
- [ ] 错误响应是否避免了内部信息泄露（无 errorDetail/stack/message）？
- [ ] 文件上传是否有类型和大小限制？
- [ ] 云函数返回格式是否统一为 `{success, error}`？
