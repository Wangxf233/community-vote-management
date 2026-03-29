# 开门 Gateway 部署说明

## 1. 架构

- 小程序 -> 云函数 openDoor
- 云函数 -> Admin API `/api/door/open-from-cloud`
- Admin API -> 本机常驻进程 `admin/gateway/door-gateway.js`
- Gateway -> MQTT Broker -> 门禁设备

## 2. 进程与资源隔离建议

- Admin API 与 Door Gateway 使用不同端口
- Door Gateway 仅监听 `127.0.0.1`
- 用 PM2 或 systemd 分别管理两个进程，设置独立内存上限和重启策略
- 建议为 gateway 单独配置日志文件和告警

## 3. 必要环境变量

### Admin 服务（admin/.env）

- `DOOR_CLOUD_ACCESS_KEY`：云函数调用 admin 接口的密钥
- `DOOR_GATEWAY_URL`：本机 gateway 地址，默认 `http://127.0.0.1:9101`
- `DOOR_GATEWAY_KEY`：admin 调用 gateway 内部接口密钥
- `DOOR_GATEWAY_TIMEOUT_MS`：调用超时，建议 12000

### Door Gateway 进程

- `DOOR_GATEWAY_HOST`：建议 `127.0.0.1`
- `DOOR_GATEWAY_PORT`：建议 `9101`
- `DOOR_GATEWAY_KEY`：与 admin 的 `DOOR_GATEWAY_KEY` 一致

### 云函数 openDoor

- `DOOR_API_BASE_URL`：admin 对外地址，如 `https://admin.example.com`
- `DOOR_CLOUD_ACCESS_KEY`：与 admin 的 `DOOR_CLOUD_ACCESS_KEY` 一致
- `DOOR_API_TIMEOUT_MS`：请求 admin 超时，建议 12000

## 4. 数据表要求

- `door_devices`：至少包含 `serial, communityId, enabled, brokerUrl, openTopic`
- 可选字段：`responseTopic, mqttUsername, mqttPassword, commandTemplate, qos, retain, ackTimeoutMs`
- `door_open_logs`：记录开门审计日志

## 5. 正式使用前检查

- 云函数和 admin 密钥已对齐
- gateway 进程健康检查通过 `/internal/health`
- `door_devices` 已配置生产 broker 与 topic
- 已完成限流策略（建议用户维度 + 设备维度）
- 已配置日志备份与告警
