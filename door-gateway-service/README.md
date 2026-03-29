# Door Gateway Service

独立门禁网关服务，用于接收 admin 下发的开门请求并发布 MQTT 指令。

## 目录说明

- server.js: 网关服务入口
- .env.example: 环境变量示例
- Dockerfile: 云托管部署镜像构建文件

## 本地运行

1. 复制 .env.example 为 .env 并填写 DOOR_GATEWAY_KEY。
2. 安装依赖并启动：

```bash
npm install
npm start
```

## 关键环境变量

- DOOR_GATEWAY_HOST: 默认 0.0.0.0
- DOOR_GATEWAY_PORT: 默认 9101
- DOOR_GATEWAY_KEY: 与 admin 的 DOOR_GATEWAY_KEY 完全一致

## 健康检查

- GET /internal/health

## 对接说明

1. admin 服务中的 DOOR_GATEWAY_URL 指向本服务域名。
2. admin 服务中的 DOOR_GATEWAY_KEY 与本服务保持一致。
3. 本服务仅暴露给 admin 调用，建议配合鉴权与访问控制策略。
