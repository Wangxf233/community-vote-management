# 社区投票管理系统

社区投票管理系统，包含微信小程序、云函数、管理后台 API 与管理前端四个子项目。

## 项目结构

```
community-vote-management/
├── miniprogram/        # 微信小程序（业主端）
├── cloudfunctions/     # 微信云开发云函数（50+ 个）
├── admin/              # 管理后台 API（Node.js / Express）
└── admin-frontend/     # 管理前端（Vue 3 / Element Plus）
```

## 子项目说明

### miniprogram/
业主使用的微信小程序端，功能包含投票、公告、报修、评价、家庭管理等。

打开方式：使用微信开发者工具打开项目根目录，选择云开发环境即可运行。

### cloudfunctions/
微信云开发云函数，覆盖登录认证、投票、投票统计、公告、报修、评价、社区管理等全部业务逻辑。

部署方式：微信开发者工具 → 右键 cloudfunctions 目录 → 「上传并部署」。

详见 [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)。

### admin/

管理后台 REST API，基于 Node.js + Express，连接微信云开发数据库。

```bash
cd admin
npm install
node server.js
```

环境变量配置：复制 `admin/.env.example` 为 `admin/.env` 并填写对应值。

部署方式：微信云托管（Docker），详见 [admin/DEPLOY_GITHUB.md](admin/DEPLOY_GITHUB.md)。

### admin-frontend/

管理后台前端，基于 Vue 3 + Vite + Element Plus。

```bash
cd admin-frontend
npm install
npm run dev    # 开发模式（代理到 localhost:3000）
npm run build  # 生产构建
```

部署方式：静态网站托管（上传 dist/ 目录），详见 [admin-frontend/DEPLOYMENT_GUIDE.md](admin-frontend/DEPLOYMENT_GUIDE.md)。

## 开发快速开始

```bash
# 1. 启动管理后台 API
cd admin && node server.js

# 2. 启动管理前端（另开终端）
cd admin-frontend && npm run dev
```

## 文档

- [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) — 完整部署流程
- [docs/api.md](docs/api.md) — API 接口文档
- [admin/REFACTORING_SUMMARY.md](admin/REFACTORING_SUMMARY.md) — 后端架构说明