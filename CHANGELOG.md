# Changelog

本文档记录社区物业服务系统的所有重要变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [未发布] — 2026-07

### Added
- **工程化基础设施**：Claude Code Skills（10 个）和 Subagents（7 个），覆盖四端开发/审查/安全/测试全流程
- **代码规范自动化**：前后端 ESLint v8 + Prettier 统一配置，Git hooks（husky + commitlint + lint-staged + 密钥扫描）
- **测试基础设施**：前端 Vitest + @vue/test-utils，后端 Jest + supertest，云函数 Jest mock 模板
- **共享类型定义**：15 个核心实体 TypeScript 类型 + 7 个枚举类型
- **隐私脱敏工具库**：手机号/身份证/姓名/地址脱敏（JS + TS + 小程序 WXS 三版本）
- **Zod 输入校验中间件**：12 组声明式 schema，覆盖报修/认证/投票/公告/用户等模块
- **统一错误码体系**：14 个错误码 + AppError 类 + 全局错误处理中间件 + 404 中间件
- **环境变量启动校验**：缺少必需变量时进程拒绝启动并给出明确错误
- **结构化日志**：pino + pino-pretty，自动屏蔽 11 个敏感字段
- **安全加固**：helmet 安全响应头 + express-rate-limit（全局限流 100次/分钟 + 登录 10次/分钟）+ CORS 白名单
- **CI/CD**：6 个 GitHub Actions Job（lint-admin / test-admin / lint-frontend / typecheck / test-frontend / build）
- **补充文档**：DEPLOY.md / DATA_SAFE.md / ARCHITECTURE.md / CHANGELOG.md

### Changed
- 文档整理：32 个散乱 MD → 16 个规范化文档
- 管理后台 API 集成全局错误处理中间件
- CORS 从 `*` 通配符改为白名单模式

### Removed
- 删除 13 个过时/重复文档（重构临时文档、散落部署文档、历史开发记录）

---

## [0.1.0] — 2025-10 ~ 2026-05

### 核心功能

#### 微信小程序（33 个页面）
- 业主端投票表决与问卷调查
- 信息公示（业委会/物业/法律法规/行业动态）
- 报修上报与进度跟踪
- 服务评价（员工评价 + 物业公司评价）
- 门禁开门（Fondcard 第三方集成）
- 业主认证（户主 + 家属邀请码机制）
- 家庭管理（家属添加/移除）
- 社区切换
- 实名认证（身份证 OCR + 房产证上传）

#### 云函数（60 个）
- 用户认证：wechatLogin、validateToken、getPhoneNumber
- 投票：createVote、listVotes、getVoteDetail、getVoteRecords、getVoteStatistics、updateVote
- 认证：submitCertification、submitBinding、getBindingInfo、getHouseConfig、verifyRealName、idCardOCR
- 家庭：generateInviteCode、familyManagement、getFamilyList、removeFamilyMember
- 报修：submitRepair、getMyRepairs、getRepairDetail、getRepairProgress、updateRepairStatus
- 评价：submitEvaluation、getMyEvaluations、listEvaluationCycles、submitCompanyEvaluation
- 公告：listAnnouncements、getAnnouncementDetail、getUnreadAnnouncementCount、markAnnouncementRead
- 门禁：openDoor、listDoorDevices
- 社区：adminCreateCommunity、adminUpdateCommunity、adminDeleteCommunity、listCommunitiesByRegion、migrateCommunityFields
- 管理员：adminListUsers、adminUpdateUser、communityAdminCreate、communityAdminUpdateAccount 等
- 工具：getTempFileURL、cleanupDeletedCommunities、initData

#### 管理后台 API（18 个路由模块）
- 认证/用户/社区/投票/认证审核/业主/报修/举报/评价/公告/门禁/Fondcard/文件上传/数据导出/区域

#### 管理前端（24 个页面）
- 登录/社区列表/社区管理/认证审核/业主名册/户主名单/投票管理/评价管理/报修管理/公告管理/通知管理/门禁管理/权限管理/成员管理/房屋配置/小区信息

#### 第三方集成
- Fondcard 门禁 HTTP API（设备管理 + 开门执行 + 权限同步）
- 腾讯云 OCR 身份证识别
- MQTT 门禁设备通信
