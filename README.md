# 社区物业服务系统

社区物业服务系统，覆盖业主投票、信息公示、报修、评价、门禁、认证、家庭管理等业务场景。包含微信小程序、云函数、管理后台 API 与管理前端四个子项目。

## 项目结构

```
community-vote-management/
├── miniprogram/        # 微信小程序（业主端，33 个页面）
├── cloudfunctions/     # 微信云函数（60 个，业务逻辑核心）
├── admin/              # 管理后台 API（Express + CloudBase）
├── admin-frontend/     # 管理前端（Vue 3 + Element Plus + TypeScript）
├── shared/             # 共享类型定义 + 隐私脱敏工具库
└── docs/               # 项目文档
```

## 功能总览

### 业主端（微信小程序）
投票表决 · 问卷调查 · 信息公示 · 报修上报 · 服务评价 · 门禁开门 · 业主认证 · 家庭管理 · 社区切换

### 管理后台
社区管理 · 投票管理 · 认证审核 · 业主名册 · 报修处理 · 评价周期 · 公告发布 · 通知推送 · 门禁设备 · 权限管理 · 数据导出

## 技术栈

| 层 | 技术 |
|----|------|
| 管理前端 | Vue 3 + Vite + Element Plus + TypeScript + Pinia |
| 管理后端 | Node.js + Express + CloudBase Node SDK v3 |
| 云函数 | wx-server-sdk v3 + CloudBase 数据库 |
| 小程序 | 微信原生框架 |
| 数据库 | CloudBase NoSQL（17 个集合） |
| 第三方 | Fondcard 门禁 API + 腾讯云 OCR 身份证识别 |
| 工程化 | ESLint + Prettier + Husky + lint-staged + Vitest + Jest |

## 快速开始

```bash
# 1. 启动管理后台 API（默认端口 3000）
cd admin
cp .env.example .env   # 编辑 .env 填写 CloudBase 凭证
npm install
npm start

# 2. 启动管理前端（默认端口 5173，代理 API 到 localhost:3000）
cd admin-frontend
npm install
npm run dev

# 3. 代码检查与测试
npm run lint           # 全项目 lint
npm test               # 全项目测试
```

## 文档索引

| 文档 | 说明 |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统架构与数据流 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | 四端部署指南 |
| [docs/api.md](docs/api.md) | API 与云函数接口文档 |
| [docs/DATA_SAFE.md](docs/DATA_SAFE.md) | 数据安全规范 |
| [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) | 测试流程指南 |
| [docs/DATABASE_INDEXES.md](docs/DATABASE_INDEXES.md) | 数据库索引 |
| [docs/admin.md](docs/admin.md) | 管理后台说明 |
| [docs/vote-management.md](docs/vote-management.md) | 投票管理 |
| [docs/repair-management.md](docs/repair-management.md) | 报修管理 |
| [docs/information-disclosure.md](docs/information-disclosure.md) | 信息公示 |
| [docs/realname-verification.md](docs/realname-verification.md) | 实名认证 |
| [docs/door-gateway-deployment.md](docs/door-gateway-deployment.md) | 门禁网关 |
| [docs/fondcard-api-quickstart.md](docs/fondcard-api-quickstart.md) | 门禁 API 快速入门 |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录 |
| [CLAUDE.md](CLAUDE.md) | AI 开发指南 |

## 环境变量

**管理后端** (`admin/.env`)：`TCB_ENV_ID` / `TCB_SECRET_ID` / `TCB_SECRET_KEY` / `PORT` / `DOOR_CLOUD_ACCESS_KEY` / `FONDCARD_API_BASE_URL`

详见 [docs/DEPLOY.md](docs/DEPLOY.md)。
