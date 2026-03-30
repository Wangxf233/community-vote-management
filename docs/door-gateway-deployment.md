# 开门服务部署说明（纯 HTTP 方案）

## 1. 架构

- 小程序 -> 云函数 openDoor
- 云函数 -> Admin API `/api/door/open-from-cloud`
- Admin API -> Fondcard HTTP API（method: `mqtt.door.open`）

说明：当前主链路已不依赖 gateway 服务。

## 2. 必要环境变量

### Admin 服务（admin/.env）

- `DOOR_CLOUD_ACCESS_KEY`：云函数调用 admin 接口密钥
- `FONDCARD_API_BASE_URL`：Fondcard 接口基础地址
- `FONDCARD_OPEN_METHOD`：开门接口 method（当前可用 `mqtt.door.open`）

### Admin 服务可选（推荐）

- `FONDCARD_API_TIMEOUT_MS`：Fondcard 请求超时，建议 12000
- `FONDCARD_OPEN_PLATFORM`：二次开发平台注册得到的 platform
- `FONDCARD_OPEN_LOGIN_ID`：`data.login.add` 返回 id

### 云函数 openDoor

- `DOOR_API_BASE_URL`：admin 对外地址，如 `https://admin.example.com`
- `DOOR_CLOUD_ACCESS_KEY`：与 admin 的 `DOOR_CLOUD_ACCESS_KEY` 一致
- `DOOR_API_TIMEOUT_MS`：请求 admin 超时，建议 12000

## 3. 数据表要求

- `door_devices`：至少包含 `serial, communityId, enabled, password`
- 推荐设备字段：`openMethod, platform, loginId, openParams`
- `door_open_logs`：记录开门审计日志

## 4. 正式使用前检查

- 云函数与 admin 的 `DOOR_CLOUD_ACCESS_KEY` 完全一致
- `DOOR_API_BASE_URL` 可从云函数网络环境访问
- `door_devices` 的每台设备均已配置设备级 `password`（string）
- 已完成限流策略（建议用户维度 + 设备维度）
- 已配置日志备份与告警
