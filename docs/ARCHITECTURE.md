# 系统架构

## 一、技术栈全景

```
┌─────────────────────────────────────────────────────────┐
│                      用户层                              │
├─────────────────────┬───────────────────────────────────┤
│   微信小程序 (业主)   │   浏览器 (管理后台)                │
│   原生框架 / 33 页面   │   Vue 3 + Element Plus            │
│   wx.cloud.callFunction│   axios → REST API                │
└─────────┬───────────┴───────────────┬───────────────────┘
          │                           │
          ▼                           ▼
┌─────────────────────┐   ┌───────────────────────────────┐
│   微信云函数 (60个)   │   │   Express API (admin/)         │
│   wx-server-sdk      │   │   @cloudbase/node-sdk v3       │
│   db.collection()    │   │   db.collection() + callFunction│
└─────────┬───────────┘   └───────────────┬───────────────┘
          │                               │
          └───────────┬───────────────────┘
                      ▼
          ┌─────────────────────┐
          │  CloudBase NoSQL    │
          │  (17 个集合)         │
          └─────────────────────┘
```

## 二、四端交互数据流

### 小程序 → 云函数
```
小程序页面 → wx.cloud.callFunction({ name, data })
          → 云函数 exports.main(event, context)
          → db.collection().get() / .add() / .update()
          → 返回 { success, data?, error? }
```

### 管理前端 → Express → 云函数/数据库
```
Vue 页面 → axios.post("/api/xxx")
        → Express 路由 (authMiddleware 鉴权)
        → db.collection().get() 直连
        或 tcb.callFunction() 代理
        → 返回 { success, data?, total? }
```

### Express → 第三方 API
```
Express 路由 → FondcardClient (HTTP POST)
             → Fondcard 门禁 API
             → 返回结果写回 db 并返回客户端
```

## 三、数据库集合关系

```
communities (社区)
    ├── users (用户: super/community/community_admin/user)
    ├── certification_applications (认证申请)
    │       └── owner_registry (业主名册)
    │       └── owner_list (户主名单)
    ├── votes (投票)
    │       └── vote_records (投票记录)
    ├── repairs (报修)
    ├── reports (举报/投诉)
    ├── announcements (公告)
    │       └── announcement_reads (公告已读记录)
    ├── evaluations (评价)
    │       ├── evaluation_staff (被评员工)
    │       └── evaluation_cycles (评价周期)
    ├── door_devices (门禁设备)
    │       └── door_open_logs (开门日志)
    ├── bindings (绑定记录)
    ├── family_invite_codes (家庭邀请码)
    ├── sms_codes (短信验证码)
    └── admin_audit (管理员审计)
```

## 四、认证与鉴权

```
小程序端:
  用户打开小程序 → wx.cloud.callFunction("wxContext")
                → 获取 OPENID
                → wechatLogin → 生成 token → 存入 users 集合
                → 后续请求携带 token 或依赖 OPENID

管理端:
  管理员登录 → POST /api/login/sms 或 /api/login/password
            → 验证通过 → 返回 token
            → 前端存 localStorage → axios 拦截器自动附加 Bearer token
            → Express authMiddleware → db.collection("users").where({ token })
            → 注入 req.user → 路由使用 req.user.communityId 做租户隔离
```

## 五、多租户隔离

核心机制：`communityId` 过滤。

- **社区管理员**：数据库查询强制过滤 `req.user.communityId`
- **超级管理员**：可跨社区操作，通过查询参数指定 `communityId`
- **业主**：通过 OPENID + `communityId` 双重校验数据归属

## 六、部署拓扑

```
微信云开发平台
├── 云函数 (60个) — 微信云函数运行时
├── 云托管 — Express API (Docker 容器)
├── 静态托管 — 管理前端 (dist/)
└── NoSQL 数据库 — 17 个集合

微信公众平台
└── 小程序 — 审核发布

第三方
└── Fondcard 门禁服务器 — HTTP API
└── 腾讯云 OCR — HTTPS API
```

## 七、关键配置文件

| 文件 | 角色 |
|------|------|
| `admin/config/db.js` | CloudBase 初始化（tcb + db 双导出） |
| `admin/middleware/auth.js` | 认证中间件 |
| `admin/middleware/validate.js` | 输入校验（Zod） |
| `admin/middleware/error-handler.js` | 全局错误处理 |
| `admin/config/env.js` | 环境变量校验 |
| `admin/utils/logger.js` | 结构化日志（pino） |
| `admin/utils/fondcard-client.js` | 门禁 HTTP 客户端 |
| `admin/utils/door-permissions.js` | 门禁权限编排 |
| `admin-frontend/src/utils/axios.ts` | HTTP 客户端（拦截器） |
| `admin-frontend/src/router.ts` | 前端路由守卫 |
| `shared/types.ts` | 全项目共享类型 |
| `shared/privacy.js` | 隐私脱敏（Node.js） |
| `shared/privacy.ts` | 隐私脱敏（TypeScript） |
| `shared/error-codes.js` | 统一错误码 |
| `miniprogram/utils/privacy.wxs` | 隐私脱敏（WXML） |
