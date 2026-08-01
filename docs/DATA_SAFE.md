# 数据安全规范

> 本规范适用于社区物业服务系统的所有数据处理场景。违反规范可能导致个人信息泄露，属于严重安全事件。

## 一、敏感字段清单

以下字段在任何环境下均被视为敏感数据，需遵循本规范的存储、传输、展示、日志规则：

| 级别 | 字段 | 所在集合 |
|------|------|---------|
| 🔴 高敏 | `idCard`（身份证号） | bindings, owner_list, owner_registry |
| 🔴 高敏 | `realNameIdCardFront`, `realNameIdCardBack`（身份证图片） | owner_list, owner_registry |
| 🔴 高敏 | `password`, `passwordHash` | users |
| 🔴 高敏 | `token` | users |
| 🟠 中敏 | `phone`（手机号） | users, certification_applications, owner_list, owner_registry, bindings |
| 🟠 中敏 | `openid` | 所有用户相关集合 |
| 🟡 低敏 | `name`（姓名） | users, certification_applications, owner_list |
| 🟡 低敏 | `address`, `region`（地址） | communities, certification_applications |

## 二、各环境数据处理规则

### 2.1 生产环境
- 手机号/身份证默认**脱敏展示**（管理后台和 API 响应）
- 查看完整数据需要**二次确认**并记录审计日志
- 数据导出需要**审批流程**

### 2.2 开发/测试环境
- **禁止**使用真实用户数据
- 测试数据使用明显标记的假数据（如手机号 `13800000000`、姓名 `测试业主`）
- 禁止将生产数据导出到本地开发机

### 2.3 日志
- **绝对禁止**在日志中打印手机号、身份证号、密码明文
- 调试时使用脱敏值：`phone.slice(0,3) + '****' + phone.slice(7)`
- 使用 pino logger（`admin/utils/logger.js`）可自动屏蔽敏感字段

## 三、数据展示脱敏规范

| 数据类型 | 脱敏方式 | 示例 |
|---------|---------|------|
| 手机号 | 前 3 后 4 掩码 | `138****1234` |
| 身份证号 | 前 4 后 4 掩码 | `3301**********1234` |
| 姓名 | 保留首字 | `张**` |
| 地址 | 默认到区级 | `浙江省杭州市西湖区 ***` |

工具函数位置：
- Node.js：`shared/privacy.js`
- TypeScript：`shared/privacy.ts`
- 小程序 WXML：`miniprogram/utils/privacy.wxs`

## 四、数据导出

### 4.1 导出审批
1. 导出请求提交 → 记录 `audit_logs`（操作人、导出范围、时间）
2. 二次确认弹窗（管理后台）
3. 导出完成后再次记录审计日志

### 4.2 导出限制
- 单次导出最多 5000 条
- 导出的手机号默认脱敏
- 需要完整手机号需单独申请

## 五、数据删除与匿名化

### 5.1 业主注销流程
1. 业主提交注销申请
2. 管理员审核通过
3. 执行数据清理：
   - **物理删除**：手机号、身份证图片、openid → token 关联
   - **匿名化保留**：投票记录（移除 openid，保留统计数据）、报修记录（移除联系方式）

### 5.2 测试数据清理
已有脚本：
- `cleanup-test-votes.js`：清理测试投票数据
- `cleanupDeletedCommunities`（云函数定时触发）：每天 02:00 清理标记为删除的社区数据

## 六、租户隔离验证清单

每个涉及 `communityId` 的功能上线前，必须验证：

- [ ] Express 路由：数据库查询是否过滤 `communityId`？
- [ ] Express 路由：URL 参数中的 `:communityId` 是否校验归属？
- [ ] 云函数：数据库查询是否过滤 `communityId`？
- [ ] 文件访问：是否校验文件所属社区？
- [ ] 门禁操作：是否校验设备归属社区？

## 七、安全事件响应

### 7.1 疑似数据泄露
1. 立即下线受影响接口
2. 排查审计日志
3. 通知数据保护负责人
4. 72 小时内完成事故报告

### 7.2 已知风险（待修复）
| 风险 | 位置 | 优先级 |
|------|------|--------|
| 越权访问其他社区公告 | `announcement.js` | P0 |
| 无归属校验的社区信息 | `communityInfo.js` | P0 |
| 错误响应泄露调用栈 | `createVote` 云函数 | P0 |
| 密码使用裸 SHA-256 | `user.js` | P0 |
| Token 明文存储无过期 | `users` 集合 | P1 |
