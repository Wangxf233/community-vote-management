# 管理后台（Admin）说明

本文件描述仓库内提供的示例管理后台（Node.js + Express）如何使用，以及管理员相关的云函数接口概览与安全建议。

目录

- 简介
- 本地运行示例
- 可用 API（Express）
- 依赖的云函数
- 安全与部署建议

## 简介

项目中包含一个最小的 admin 服务示例，位于 `admin/` 目录。该服务示例使用 `@cloudbase/node-sdk` 调用你在 CloudBase 中部署的管理员云函数（例如 `adminListBindings`、`adminGetBinding`、`adminUpdateBinding`）。

注意：该示例仅用于本地开发/原型。生产环境请把密钥放在安全的密钥管理服务或云环境变量中，并做更严格的鉴权与审计。

## 本地运行示例

1. 进入目录：

   cd admin

2. 安装依赖：

   npm install

3. 复制并编辑环境示例：

   cp .env.example .env

   # 填写 TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY

4. 启动服务：

   npm start

服务默认监听 `PORT`（默认 3000）。

## 可用 API（Express）

- POST /login

  - body: { token }
  - 返回: { success: true, user } 或 401

- GET /bindings

  - headers: Authorization: Bearer <token>
  - query: page, pageSize, status, communityName
  - 返回: adminListBindings 的结果（{ success, data, total }）

- GET /bindings/:id

  - headers: Authorization: Bearer <token>
  - 返回: adminGetBinding 的结果

- PATCH /bindings/:id
  - headers: Authorization: Bearer <token>
  - body: { action: 'approve'|'reject', reason? }
  - 返回: adminUpdateBinding 的结果

## 依赖的云函数

- `adminListBindings`：分页列出绑定申请（需要 adminToken）
- `adminGetBinding`：获取单条绑定详情（需要 adminToken）
- `adminUpdateBinding`：批准/驳回绑定并写审计（需要 adminToken）

如果你希望管理后台直接操作 DB（而不是通过云函数），也可以在 `server.js` 中使用 `tcb.database()` 直接读写集合，但仍要确保服务端凭据妥善保管。

## 安全与部署建议

- 永远不要把 `TCB_SECRET_ID` / `TCB_SECRET_KEY` 写进前端代码或公开仓库。
- 后台应对所有请求做鉴权；示例使用用户 `token` 且要求 `users.role==='admin'`。
- 关键操作（approve/reject）必须保留审计日志（`admin_audit` 集合），并记录操作者、时间与理由。
- 生产部署建议使用企业级 secret 管理（环境变量、KMS），并在云托管或容器中运行服务。

---

如需我把 admin 前端骨架也 scaffold 出来（React + AntD），或把更多 admin 云函数（社区 CRUD、用户管理）补齐，请告诉我下一步。
