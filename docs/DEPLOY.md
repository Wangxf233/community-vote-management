# 部署文档

## 环境说明

| 环境 | 用途 | CloudBase 环境 |
|------|------|----------------|
| dev | 本地开发 | 个人 CloudBase 环境 |
| staging | 预发布测试 | 待定 |
| prod | 生产环境 | `cloud1-6ghienoi526fff51` |

## 一、管理后台 API (admin/)

### 本地运行
```bash
cd admin
cp .env.example .env   # 编辑 .env 填写实际密钥
npm install
npm start              # 启动在 http://localhost:3000
```

### 部署到云托管
```bash
# 使用 CloudBase CLI
tcb run deploy --project admin
```
云托管配置（`admin/cloudbaserc.json`）：CPU 0.25 核，内存 0.5 GB，副本 1-3，自动扩缩容。

### 健康检查
```
GET /api/health → { "status": "ok", "timestamp": "...", "uptime": ... }
```

## 二、管理后台前端 (admin-frontend/)

### 本地运行
```bash
cd admin-frontend
npm install
npm run dev            # 启动在 http://localhost:5173，代理 API 到 localhost:3000
```

### 生产构建
```bash
cd admin-frontend
npm run build          # 输出到 dist/
```

### 部署到静态托管
将 `dist/` 目录上传到 CloudBase 静态网站托管。

## 三、云函数 (cloudfunctions/)

### 部署方式
使用微信开发者工具：
1. 打开项目根目录
2. 右键 `cloudfunctions/` 目录
3. 选择"上传并部署：所有云函数"

或使用 CloudBase CLI：
```bash
tcb fn deploy <functionName>
```

### 环境变量
需要环境变量的云函数（`idCardOCR`、`openDoor`）：
- `TCB_SECRET_ID` / `TCB_SECRET_KEY`：腾讯云 API 密钥
- `DOOR_API_BASE_URL` / `DOOR_CLOUD_ACCESS_KEY`：门禁 API 配置

在云开发控制台 → 云函数 → 函数配置中设置。

## 四、微信小程序 (miniprogram/)

### 开发
使用微信开发者工具打开项目根目录。

### 发布
1. 微信开发者工具 → 上传代码
2. 微信公众平台 → 版本管理 → 提交审核

## 五、数据库备份与恢复

### 备份
CloudBase 控制台 → 数据库 → 导出（JSON/CSV 格式）

### 恢复
CloudBase 控制台 → 数据库 → 导入

### 重要集合
`communities`, `users`, `certification_applications`, `owner_list`, `owner_registry`, `votes`, `vote_records`

## 六、回滚策略

| 组件 | 回滚方式 |
|------|---------|
| 云函数 | CloudBase 控制台 → 版本管理 → 回滚到历史版本 |
| 云托管 | 重新部署上一个 Docker 镜像版本 |
| 静态托管 | 重新上传上一个版本的 `dist/` |
| 小程序 | 微信公众平台 → 版本管理 → 回滚线上版本 |

## 七、环境变量清单

### admin/.env（后端）
| 变量 | 必需 | 说明 |
|------|------|------|
| `TCB_ENV_ID` | ✅ | CloudBase 环境 ID |
| `TCB_SECRET_ID` | ✅ | CloudBase Secret ID |
| `TCB_SECRET_KEY` | ✅ | CloudBase Secret Key |
| `PORT` | 否 | 默认 3000 |
| `DOOR_CLOUD_ACCESS_KEY` | 否 | 门禁云函数调用密钥 |
| `FONDCARD_API_BASE_URL` | 否 | 门禁第三方 API |
| `LOG_LEVEL` | 否 | 默认 info |

### admin-frontend 构建时变量
| 变量 | 说明 |
|------|------|
| `VITE_API_BASE_URL` | API 地址（生产环境需配置） |
