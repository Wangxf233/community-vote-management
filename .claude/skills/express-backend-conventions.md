# express-backend-conventions

Express + CloudBase Admin SDK 后端编码规范。适用于 `admin/` 下的路由、中间件、工具函数开发。

## 一、路由结构

- 每个资源一个 `routes/*.js` 文件
- 中间件放在 `middleware/`，工具函数放在 `utils/`
- 路由文件统一使用 `express.Router()` + `module.exports = router`

## 二、响应格式（强制统一）

### 成功响应
```json
// 列表
{ "success": true, "data": [...], "total": 100, "page": 1, "pageSize": 20 }
// 单条/操作
{ "success": true, "data": { "_id": "...", ... } }
// 无返回数据
{ "success": true }
```

### 错误响应
```json
{ "success": false, "error": "error_code_string" }
```
HTTP 状态码必须语义化：
- `400` — 参数错误/校验失败
- `401` — 未认证
- `403` — 无权限/小区到期
- `404` — 资源不存在
- `409` — 资源冲突
- `500` — 服务器内部错误

### 违规写法（禁止）
```javascript
// ❌ 缺少 success: false
res.json({ error: "something wrong" })
// ❌ 用 200 返回错误
res.status(200).json({ success: false, error: "..." })
// ❌ 暴露原始错误对象
res.status(500).json({ success: false, error: e.message || e })
// ✅ 正确写法
res.status(500).json({ success: false, error: "服务器内部错误" })
```

## 三、数据库访问规范

### 3.1 统一入口
```javascript
const { db, tcb } = require("../config/db");
// 禁止自行初始化 cloudbase
```

### 3.2 写操作（强制 {data} 包装）
```javascript
// ✅ 正确 — CloudBase Node SDK v3 标准
await db.collection("repairs").add({ data: repairData });
await db.collection("users").doc(id).update({ data: updates });

// ❌ 错误 — 不兼容 v3 SDK
await db.collection("repairs").add(repairData);
await db.collection("users").doc(id).update(updates);
```

### 3.3 两种数据库访问模式
- **直连模式**：`db.collection().where().get()` — 适用大部分场景
- **代理模式**：`tcb.callFunction({ name, data })` — 适用已有云函数封装的逻辑

新文件开头用注释标明模式：
```javascript
// 数据库模式: db.collection() 直连
// 数据库模式: tcb.callFunction() 代理
```

## 四、输入验证

- **必须**使用 `admin/middleware/validate.js` 中间件做 schema 校验（Stage 2 后可用）
- **禁止**直接透传 `req.body` / `req.query` 给数据库或云函数
- 过渡期（validate 中间件未创建前）：在路由 handler 第一段手动校验，格式与 validate 中间件保持一致

## 五、多租户隔离（社区数据）🔴

- 每个涉及社区数据的查询**必须**过滤 `communityId`
- 社区管理员从 `req.user.communityId` 获取所属社区
- URL 路径参数中的 `:communityId` 必须与 `req.user.communityId` 校验匹配（超级管理员除外）
- 超级管理员可以通过 query/body 参数指定操作的社区

```javascript
// ✅ 正确
const query = { communityId: user.communityId, ...otherFilters };
// ❌ 越权 — 信任了用户传入的 communityId
const query = { communityId: req.query.communityId, ... };
```

## 六、错误处理

详细规范见 `error-handling` Skill。核心要点：
- 所有路由 handler 包裹 try-catch
- catch 块中记录日志后返回语义化错误
- 禁止 `e.message || e`，改用 `e.message || "服务器内部错误"`

## 七、禁止事项

- 禁止在路由中写 SQL/NoSQL 拼接
- 禁止绕过 authMiddleware 创建公开的敏感接口
- 禁止在循环中查询数据库（N+1 问题）
- 禁止在同一个路由文件中混用 `db.collection()` 和 `tcb.callFunction()` 而不加注释说明
