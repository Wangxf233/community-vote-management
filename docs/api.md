# API 接口文档

本文档涵盖 REST API（Express 后端）和云函数调用（小程序/后端 → 云函数）两套接口体系。

## 一、通用约定

### 1.1 返回格式

所有接口统一使用：

```json
// 成功
{ "success": true, "data": { ... } }
{ "success": true, "data": [...], "total": 100, "page": 1, "pageSize": 20 }

// 失败
{ "success": false, "error": "error_code" }
```

### 1.2 错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `token_missing` | 401 | 缺少认证 token |
| `token_invalid` | 401 | token 无效 |
| `token_expired` | 401 | token 已过期 |
| `insufficient_permissions` | 403 | 权限不足 |
| `community_expired` | 403 | 小区服务到期 |
| `cross_community_access` | 403 | 越权访问其他小区 |
| `validation_error` | 400 | 参数校验失败 |
| `missing_params` | 400 | 缺少必要参数 |
| `resource_not_found` | 404 | 资源不存在 |
| `resource_conflict` | 409 | 资源冲突 |
| `internal_error` | 500 | 服务器内部错误 |
| `rate_limit_exceeded` | 429 | 请求频率超限 |

### 1.3 分页

请求：`{ page: number, pageSize: number }`（page 从 1 开始，pageSize 默认 20，最大 100）

响应：`{ data: [...], total: number, page: number, pageSize: number }`

---

## 二、REST API（Express 后端）

Base URL: `/api`

### 2.1 健康检查

```
GET /api/health
→ { "status": "ok", "timestamp": "...", "uptime": ... }
```

### 2.2 认证

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/login/sms` | 短信验证码登录 | 公开 |
| POST | `/api/login/password` | 密码登录 | 公开 |
| GET | `/api/me` | 获取当前用户信息 | Bearer token |

### 2.3 社区管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/communities` | 社区列表 | 公开 |
| POST | `/api/communities` | 创建社区 | super |
| PUT | `/api/communities/:id` | 更新社区 | super |
| DELETE | `/api/communities/:id` | 删除社区 | super |
| GET | `/api/communities/:id/admin-account` | 社区管理员账号 | super |

### 2.4 用户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 用户列表 |
| POST | `/api/register` | 注册管理员 |
| PATCH | `/api/users/:id` | 更新用户 |
| POST | `/api/users/:id/change-password` | 修改密码 |

### 2.5 投票

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/votes` | 投票列表 |
| POST | `/api/votes` | 创建投票 |

### 2.6 认证审核

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/residents` | 业主列表 |
| POST | `/api/residents/:id/audit` | 审核业主 |
| PUT | `/api/residents/:id` | 修改业主信息 |
| DELETE | `/api/residents/:id` | 删除业主 |
| GET | `/api/certification-applications` | 认证申请列表 |
| POST | `/api/certification-applications/:id/review` | 审核认证申请 |
| DELETE | `/api/certification-applications/:id` | 删除认证申请 |

### 2.7 业主名册

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/owner-registry` | 业主名册 |
| POST | `/api/owner-registry` | 手动添加 |
| POST | `/api/owner-registry/import` | Excel 导入 |
| PUT | `/api/owner-registry/:id` | 编辑 |
| DELETE | `/api/owner-registry/:id` | 删除 |
| GET | `/api/owner-list` | 户主名单 |

### 2.8 报修

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/repairs` | 报修列表 |
| POST | `/api/repairs` | 创建报修 |
| PUT | `/api/repairs/:id` | 更新状态 |
| DELETE | `/api/repairs/:id` | 删除报修 |

### 2.9 举报/投诉

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports` | 举报列表 |
| POST | `/api/reports` | 提交举报 |
| DELETE | `/api/reports/:id` | 删除举报 |

### 2.10 评价

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/evaluation/staff` | 员工列表 |
| POST | `/api/evaluation/staff` | 添加员工 |
| PUT | `/api/evaluation/staff/:id` | 编辑员工 |
| DELETE | `/api/evaluation/staff/:id` | 删除员工 |
| GET | `/api/evaluation/cycles` | 评价周期 |
| POST | `/api/evaluation/cycles` | 创建周期 |
| PUT | `/api/evaluation/cycles/:id` | 编辑周期 |

### 2.11 公告与通知

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/announcements` | 公告列表 |
| POST | `/api/announcements` | 发布公告 |
| PUT | `/api/announcements/:id` | 编辑公告 |
| DELETE | `/api/announcements/:id` | 删除公告 |
| GET | `/api/notifications` | 通知列表 |
| POST | `/api/notifications` | 发送通知 |

### 2.12 门禁

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/door/devices` | 设备列表 |
| POST | `/api/door/devices` | 添加设备 |
| PUT | `/api/door/devices/:id` | 编辑设备 |
| DELETE | `/api/door/devices/:id` | 删除设备 |
| POST | `/api/door/open-from-cloud` | 云函数回调开门 |

### 2.13 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload` | 文件上传（multipart） |
| GET | `/api/export/bindings` | 导出绑定数据 CSV |
| GET | `/api/house-config` | 房屋配置 |
| POST | `/api/house-config` | 创建房屋配置 |
| GET | `/api/community-info/:communityId` | 小区基本信息 |
| POST | `/api/community-info/:communityId` | 更新小区信息 |
| GET | `/api/regions` | 省市区数据 |
| GET | `/api/bindings` | 绑定列表 |

---

## 三、云函数接口

### 3.1 认证类

| 云函数 | 说明 | 入参 | 出参 |
|--------|------|------|------|
| `wechatLogin` | 微信登录/注册 | `{ code?, profile?, forceNewToken? }` | `{ success, token, user }` |
| `validateToken` | Token 校验 | `{ token }` | `{ success, valid, userInfo? }` |
| `getPhoneNumber` | 获取微信手机号 | `{ encryptedData, iv }` | `{ success, phoneNumber }` |

### 3.2 投票类

| 云函数 | 说明 | 入参 |
|--------|------|------|
| `createVote` | 创建投票/问卷 | `{ communityId, type, title, detail, ... }` |
| `listVotes` | 投票列表 | `{ communityId, type?, page?, pageSize? }` |
| `getVoteDetail` | 投票详情 | `{ voteId }` |
| `getVoteRecords` | 投票记录 | `{ voteId }` |
| `getVoteStatistics` | 投票统计 | `{ voteId }` |
| `updateVote` | 投票/提交选票 | `{ voteId, openid, optionId, signatureUrl }` |

### 3.3 认证类（业主/家属）

| 云函数 | 说明 | 入参 |
|--------|------|------|
| `submitCertification` | 提交认证（户主/家属/实名） | `{ type, name, phone, ... }` |
| `submitBinding` | 提交绑定 | `{ info: { region, communityName, ... } }` |
| `getBindingInfo` | 获取绑定状态 | `{}` |
| `getHouseConfig` | 获取房屋配置 | `{ communityId }` |
| `verifyRealName` | 验证实名 | `{ idCard, name }` |
| `idCardOCR` | 身份证 OCR 识别 | `{ imageUrl }` |
| `getMyHouses` | 我的房产列表 | `{}` |
| `getUserCommunities` | 用户所属社区 | `{}` |

### 3.4 家庭管理

| 云函数 | 说明 | 入参 |
|--------|------|------|
| `generateInviteCode` | 生成邀请码 | `{}` |
| `familyManagement` | 家属管理 | `{ action, ... }` |
| `getFamilyList` | 家属列表 | `{}` |
| `removeFamilyMember` | 移除家属 | `{ familyId }` |

### 3.5 报修类

| 云函数 | 说明 | 入参 |
|--------|------|------|
| `submitRepair` | 提交报修 | `{ communityId, equipment, location, description, ... }` |
| `getMyRepairs` | 我的报修 | `{}` |
| `getRepairDetail` | 报修详情 | `{ repairId }` |
| `getRepairProgress` | 报修进度 | `{ repairId }` |
| `updateRepairStatus` | 更新报修状态 | `{ repairId, status }` |

### 3.6 评价类

| 云函数 | 说明 | 入参 |
|--------|------|------|
| `submitEvaluation` | 提交员工评价 | `{ cycleId, staffId, scores, ... }` |
| `getMyEvaluations` | 我的评价 | `{}` |
| `getEvaluationStaff` | 被评员工列表 | `{ cycleId }` |
| `listEvaluationCycles` | 评价周期列表 | `{ communityId }` |
| `submitCompanyEvaluation` | 提交公司评价 | `{ cycleId, scores, ... }` |
| `getMyCompanyEvaluations` | 我的公司评价 | `{}` |
| `listCompanyEvaluationCycles` | 公司评价周期 | `{ communityId }` |

### 3.7 公告类

| 云函数 | 说明 | 入参 |
|--------|------|------|
| `listAnnouncements` | 公告列表 | `{ communityId, type?, page?, pageSize? }` |
| `getAnnouncementDetail` | 公告详情 | `{ announcementId }` |
| `getUnreadAnnouncementCount` | 未读公告数 | `{ communityId }` |
| `markAnnouncementRead` | 标记已读 | `{ announcementId }` |

### 3.8 门禁类

| 云函数 | 说明 | 入参 |
|--------|------|------|
| `openDoor` | 开门 | `{ deviceId, communityId }` |
| `listDoorDevices` | 可开门设备 | `{ communityId }` |

### 3.9 管理类

| 云函数 | 说明 | 权限 |
|--------|------|------|
| `adminListCommunities` | 社区列表 | admin |
| `adminCreateCommunity` | 创建社区 | admin |
| `adminUpdateCommunity` | 更新社区 | admin |
| `adminDeleteCommunity` | 删除社区 | admin |
| `adminListUsers` | 用户列表 | admin |
| `adminUpdateUser` | 更新用户 | admin |
| `adminListBindings` | 绑定列表 | admin |
| `adminUpdateBinding` | 审核绑定 | admin |
| `adminGetBinding` | 绑定详情 | admin |
| `adminExportBindingsCSV` | 导出绑定 CSV | admin |
| `communityAdminCreate` | 创建社区管理员 | community admin |
| `communityAdminDelete` | 删除社区管理员 | community admin |
| `communityAdminList` | 社区管理员列表 | community admin |
| `communityAdminUpdateAccount` | 更新管理员账号 | community admin |
| `communityAdminUpdatePermissions` | 更新管理员权限 | community admin |

### 3.10 工具类

| 云函数 | 说明 |
|--------|------|
| `wxContext` | 获取 OPENID/APPID/UNIONID |
| `getTempFileURL` | 云存储文件临时链接 |
| `listCommunitiesByRegion` | 按区域查社区 |
| `checkCommunity` | 检查社区是否存在 |
| `getCommunityInfo` | 获取社区信息 |
| `getDetail` | 通用实体读取 |
| `cleanupDeletedCommunities` | 定时清理已删社区（每天 02:00） |
| `migrateCommunityFields` | 社区字段迁移 |
| `submitReport` | 提交举报 |
| `getReportProgress` | 举报进度 |
| `initData` | 初始化种子数据 |
| `addTestUser` | 添加测试用户 |

---

## 四、认证申请流程（certification_applications）

### 4.1 户主认证（type: "owner"）

```
请求: { type: "owner", name, phone, region, properties: [{ communityName, building, unit, room }] }

流程:
1. 校验手机号格式
2. 查询 communities 匹配 communityName
3. 检查该用户是否已有 pending/approved 申请
4. 检查房号是否已被认证
5. 创建 certification_applications 记录 (status: "pending")
6. 管理员审核通过后 → 写入 owner_list + 可选门禁授权

返回: { code: 0, message: "已提交N套房产的认证申请" }
     或 { code: -1, message: "错误原因" }
```

### 4.2 家属认证（type: "family"）

```
请求: { type: "family", inviteCode, name, phone, relation }

流程:
1. 验证邀请码有效性（存在、未过期、未使用）
2. 获取户主认证信息
3. 创建家属认证记录（status: "approved" 自动通过）
4. 标记邀请码为已使用

返回: { code: 0, message: "注册成功" }
```

### 4.3 实名认证（type: "realname"）

```
请求: { type: "realname", idCardFront, idCardBack, certType, certImage }
       certType: "property" | "contract" | "payment"

流程:
1. 查询用户已通过的户主认证
2. 更新 owner_registry 和 owner_list 的实名认证字段
3. 状态改为 "pending"，等待管理员审核

返回: { success: true, message: "提交成功" }
```
