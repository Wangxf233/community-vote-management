# CLAUDE.md — 社区物业服务系统

## 项目架构

```
community-vote-management/
├── miniprogram/        # 微信小程序（业主端，33 个页面）
│                       #   调用方式: wx.cloud.callFunction → 云函数
├── cloudfunctions/     # 微信云函数（60 个函数，业务逻辑核心）
│                       #   运行时: wx-server-sdk + db.collection()
├── admin/              # 管理后台 API（Express + @cloudbase/node-sdk v3）
│                       #   数据库: db.collection() 直连 + tcb.callFunction() 代理
└── admin-frontend/     # 管理前端（Vue 3 + Vite + Element Plus + TypeScript）
                        #   调用方式: axios → /api → Express
```

## 常用命令

```bash
# 启动管理后台 API
cd admin && node server.js

# 启动管理前端（开发模式，代理到 localhost:3000）
cd admin-frontend && npm run dev

# 管理前端生产构建
cd admin-frontend && npm run build
```

## 关键配置文件

| 文件 | 用途 |
|------|------|
| `admin/config/db.js` | CloudBase SDK 初始化（tcb + db 双导出） |
| `admin/middleware/auth.js` | 认证中间件（authMiddleware / superAdminOnly） |
| `admin/server.js` | Express 入口（路由挂载 + CORS + 全局错误处理） |
| `admin/utils/door-permissions.js` | 门禁权限编排（Fondcard HTTP → CloudBase 写回） |
| `admin/utils/fondcard-client.js` | Fondcard 第三方门禁 HTTP 客户端 |
| `admin-frontend/src/utils/axios.ts` | Axios 实例（请求拦截/响应拦截/401 处理） |
| `admin-frontend/src/router.ts` | Vue Router 配置（路由守卫 + 权限校验） |
| `cloudfunctions/validateToken/index.js` | 云函数侧 Token 验证 |
| `miniprogram/app.js` | 小程序入口（全局数据/静默登录/权限检查） |

## 环境变量

**后端** (`admin/.env`)：
- `TCB_ENV_ID` / `TCB_SECRET_ID` / `TCB_SECRET_KEY` — CloudBase 凭证
- `PORT` — 服务端口（默认 3000）
- `DOOR_CLOUD_ACCESS_KEY` — 门禁云函数调用 admin 的共享密钥
- `FONDCARD_API_BASE_URL` / `FONDCARD_OPEN_METHOD` — 门禁第三方 API

**示例文件**: `admin/.env.example`

## 数据库

**类型**: 微信 CloudBase NoSQL（类似 MongoDB）

**主要集合**: communities, users, votes, vote_records, certification_applications, owner_list, owner_registry, repairs, reports, evaluations, announcements, door_devices, door_open_logs, bindings, family_invite_codes, sms_codes

**索引文档**: `docs/DATABASE_INDEXES.md`

**SDK 差异**:
- 云函数使用 `wx-server-sdk`：`cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`，单次 `.get()` 最多 100 条
- Express 后端使用 `@cloudbase/node-sdk`：`cloudbase.init({ env, secretId, secretKey })`，Admin 权限

## Claude Code 自动任务分发

你不需要手动指定 Agent。直接描述需求，我会自动选择合适的专用 Agent：

| 任务特征 | 自动使用的 Agent |
|---------|-----------------|
| 涉及 `admin-frontend/` 下 Vue 页面/组件 | → frontend-developer |
| 涉及 `admin/` 下 Express 路由/中间件 | → backend-developer |
| 涉及 `cloudfunctions/` 下云函数 | → cloudfunction-developer |
| 涉及 `miniprogram/` 下小程序页面 | → miniprogram-developer |
| 🔴 功能开发完成，编写测试（标准步骤，不可跳过） | → test-writer |
| 代码审查 / PR Review | → code-reviewer |
| 安全检查 / 隐私审计 | → security-auditor |

### 每次功能开发的标准流程

```
1. Developer Agent 写代码（根据任务自动选择）
2. Test-writer Agent 写测试（自动触发）
3. Code-reviewer Agent 审查（自动触发）
4. 测试全部通过 → 可以上线
```

第 2 步和第 3 步可以并行执行。

## 已知技术债务

| 债务 | 位置 | 风险 |
|------|------|------|
| 云函数返回格式三套并存 | cloudfunctions/ | 调用方需兼容三套格式 |
| 全项目隐私数据零脱敏 | 四端 | 合规风险 |
| getVoteStatistics ~170 行死代码 | cloudfunctions/getVoteStatistics/index.js | 维护混淆 |
| 多个云函数存在工具函数重复 | openDoor/listDoorDevices 等 | 维护成本 |
| admin 中 `.add()` 语法不一致 | admin/routes/ | 可能静默失败 |
| announcement.js 越权漏洞 | admin/routes/announcement.js | **P0 安全** |
| communityInfo.js 无归属校验 | admin/routes/communityInfo.js | **P0 安全** |
| 密码使用裸 SHA-256 | admin/routes/user.js | **P0 安全** |

> 修改上述文件时，必须同步修复对应债务。详见 `.claude/rules.md` 第 8-10 条。
