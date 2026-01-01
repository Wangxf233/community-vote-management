# 投票管理功能部署说明

## 已完成的工作

### 1. 前端页面

- ✅ 创建 `VoteManagement.vue` - 投票管理主页面

  - 权限检查（只有拥有 vote 或 survey 权限的用户才能访问）
  - 选项卡切换（投票表决/问卷调查）
  - 筛选功能（标题、发起人、发布时间、截止时间）
  - 投票列表展示
  - 数据统计弹窗
  - 投票管理弹窗（暂停/恢复、延长截止时间）
  - 小程序结果展示开关

- ✅ 创建 `AddVote.vue` - 添加投票/问卷页面

  - 标题、详情输入（必填）
  - 附件上传
  - 发起人自动填充（从用户的 department 字段获取）
  - 发布时间选择（立即发布/自定义时间）
  - 截止时间选择（快捷选项：1 天/3 天/7 天/1 个月，或自定义）
  - 投票说明
  - 小程序结果展示开关

- ✅ 更新路由配置 `router.ts`

### 2. 后端云函数

创建了 4 个云函数：

1. **listVotes** - 获取投票列表

   - 支持按 communityId、type、title、initiator、时间范围筛选
   - 返回投票列表和总数

2. **createVote** - 创建投票/问卷

   - 保存所有投票信息
   - 自动设置 status 为 active

3. **getVoteStatistics** - 获取投票统计数据

   - 统计总人数、参与人数
   - 统计同意/不同意/弃权的人数和比例
   - 对于投票表决，额外统计专有面积数据

4. **updateVote** - 更新投票状态
   - 支持暂停/恢复投票
   - 支持更新截止时间
   - 支持切换小程序结果展示

### 3. 后端 API 接口

在 `server.js` 中添加了以下接口：

- `GET /api/votes` - 获取投票列表（支持筛选）
- `POST /api/votes` - 创建投票/问卷
- `GET /api/votes/:id/statistics` - 获取统计数据
- `PUT /api/votes/:id/pause` - 暂停投票
- `PUT /api/votes/:id/resume` - 恢复投票
- `PUT /api/votes/:id/deadline` - 更新截止时间
- `PUT /api/votes/:id/show-result` - 切换结果展示
- `POST /api/upload` - 文件上传（待实现具体逻辑）

## 需要部署的云函数

已安装依赖，需要通过微信开发者工具上传：

1. `cloudfunctions/listVotes`
2. `cloudfunctions/createVote`
3. `cloudfunctions/getVoteStatistics`
4. `cloudfunctions/updateVote`

## 数据库集合

需要确保以下集合存在：

### 1. votes 集合

存储投票和问卷数据：

```javascript
{
  communityId: String,        // 小区ID
  type: String,               // 'vote' 或 'survey'
  title: String,              // 标题
  detail: String,             // 详情
  attachment: String,         // 附件URL
  attachmentName: String,     // 附件名称
  initiator: String,          // 发起人（业委会/物业公司）
  publishTime: Date,          // 发布时间
  deadlineTime: Date,         // 截止时间
  description: String,        // 投票说明
  showResult: Boolean,        // 是否在小程序展示结果
  status: String,             // 'active', 'paused', 'ended'
  deleted: Boolean,           // 软删除标记
  createdAt: Date,
  updatedAt: Date
}
```

### 2. vote_records 集合

存储用户投票记录（用于统计）：

```javascript
{
  voteId: String,             // 投票ID
  userId: String,             // 用户ID
  communityId: String,        // 小区ID
  choice: String,             // 'agree', 'disagree', 'abstain'
  area: Number,               // 专有面积（用于投票表决统计）
  deleted: Boolean,
  createdAt: Date
}
```

## 待完善功能

### 1. 文件上传

`/api/upload` 接口需要实现实际的文件上传逻辑：

- 使用 `multer` 处理文件上传
- 上传到云存储
- 返回云存储 URL

建议实现：

```javascript
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

app.post("/api/upload", upload.single("file"), async (req, res) => {
  // 上传文件到云存储
  const fileUrl = await uploadToCloud(req.file);
  return res.json({
    success: true,
    url: fileUrl,
    name: req.file.originalname,
  });
});
```

### 2. 权限验证

确保在 `permissions` 管理页面中，可以授予用户以下权限：

- `vote` - 投票表决权限
- `survey` - 问卷调查权限

### 3. 小程序端功能

需要在小程序端实现：

- 投票列表展示
- 投票详情页
- 投票操作（同意/不同意/弃权）
- 根据 showResult 字段决定是否展示结果

## 测试步骤

1. **权限测试**

   - 创建一个没有 vote 和 survey 权限的账号
   - 点击"投票管理"应该提示"暂无权限"
   - 授予 vote 权限后，应该能看到"投票表决"页
   - 授予 survey 权限后，应该能看到"问卷调查"页

2. **创建投票**

   - 点击"添加投票"按钮
   - 填写必填项（标题、详情）
   - 验证发起人自动填充
   - 测试发布时间和截止时间的各种选项
   - 提交后应该在列表中显示

3. **列表筛选**

   - 测试按标题搜索
   - 测试按发起人筛选
   - 测试按时间范围筛选
   - 点击重置应该清空所有筛选条件

4. **数据统计**

   - 点击"数据统计"按钮
   - 应该显示人数统计
   - 投票表决应该额外显示面积统计

5. **投票管理**

   - 点击"投票管理"按钮
   - 测试暂停投票功能
   - 测试恢复投票功能
   - 测试更新截止时间功能

6. **结果展示**
   - 点击"小程序结果展示"
   - 应该弹出确认框
   - 确认后按钮文案变为"取消小程序结果展示"
   - 再次点击应该能取消

## 注意事项

1. 确保用户的 `department` 字段已正确设置（业委会/物业公司）
2. 云函数部署后需要配置权限
3. 需要确保 `bindings` 集合包含专有面积（area）字段
4. 文件上传功能需要配置云存储
5. 定时任务可以考虑自动将过期的投票状态改为 'ended'
