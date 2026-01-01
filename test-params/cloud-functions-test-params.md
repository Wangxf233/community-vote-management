# 云函数单元测试参数

在微信开发者工具中，右键点击云函数 → 云函数测试 → 输入以下测试参数

---

## 1. wechatLogin（微信登录）

### 测试用例 1.1：首次登录创建新用户

```json
{
  "openid": "test_openid_001",
  "nickname": "测试用户1",
  "avatarUrl": "https://example.com/avatar1.jpg"
}
```

**预期结果：**

```json
{
  "success": true,
  "token": "t1234567890abc",
  "user": {
    "_id": "user_id_xxx",
    "openid": "test_openid_001",
    "nickname": "测试用户1",
    "avatarUrl": "https://example.com/avatar1.jpg"
  }
}
```

---

### 测试用例 1.2：已存在用户登录

```json
{
  "openid": "test_openid_001"
}
```

**预期结果：** 返回现有用户信息和 token

---

### 测试用例 1.3：强制生成新 token

```json
{
  "openid": "test_openid_001",
  "forceNewToken": true
}
```

**预期结果：** 返回新的 token

---

### 测试用例 1.4：更新用户昵称和头像

```json
{
  "openid": "test_openid_001",
  "profile": {
    "nickName": "更新后的昵称",
    "avatarUrl": "https://example.com/new-avatar.jpg"
  }
}
```

**预期结果：** 用户信息已更新

---

### 测试用例 1.5：缺少 openid（异常情况）

```json
{}
```

**预期结果：**

```json
{
  "success": false,
  "error": "无法解析 openid，请从小程序内调用或提供 event.openid 进行测试"
}
```

---

## 2. submitBinding（提交房屋绑定）

### 测试用例 2.1：户主提交绑定申请（正常情况）

```json
{
  "openid": "test_openid_001",
  "phone": "13800138000",
  "name": "张三",
  "region": "北京市海淀区",
  "communityName": "阳光花园",
  "building": "1号楼",
  "block": "A座",
  "room": "101",
  "residentialArea": 120.5,
  "commercialArea": 0,
  "parkingArea": 15,
  "carNumber": "京A12345",
  "userType": "owner",
  "realName": "张三",
  "idCard": "110101199001011234",
  "proofImages": ["cloud://xxx/proof1.jpg", "cloud://xxx/proof2.jpg"]
}
```

**预期结果：**

```json
{
  "success": true,
  "bindingId": "binding_xxx",
  "message": "绑定申请已提交，等待审核"
}
```

---

### 测试用例 2.2：家庭成员提交绑定申请

```json
{
  "openid": "test_openid_002",
  "phone": "13800138001",
  "name": "李四",
  "region": "北京市海淀区",
  "communityName": "阳光花园",
  "building": "1号楼",
  "block": "A座",
  "room": "101",
  "userType": "family",
  "householdRelation": "配偶",
  "ownerOpenid": "test_openid_001"
}
```

**预期结果：** 成功提交家庭成员绑定申请

---

### 测试用例 2.3：缺少必填字段（异常情况）

```json
{
  "openid": "test_openid_001",
  "name": "张三"
}
```

**预期结果：**

```json
{
  "success": false,
  "error": "phone和name必填"
}
```

---

### 测试用例 2.4：户主缺少实名认证（异常情况）

```json
{
  "openid": "test_openid_001",
  "phone": "13800138000",
  "name": "张三",
  "userType": "owner",
  "communityName": "阳光花园"
}
```

**预期结果：**

```json
{
  "success": false,
  "error": "户主必须完成实名认证"
}
```

---

### 测试用例 2.5：重复绑定同一房屋（异常情况）

```json
{
  "openid": "test_openid_001",
  "phone": "13800138000",
  "name": "张三",
  "communityName": "阳光花园",
  "building": "1号楼",
  "block": "A座",
  "room": "101",
  "userType": "owner",
  "realName": "张三"
}
```

**预期结果：** 检测到重复绑定提示

---

## 3. createVote（创建投票）

### 测试用例 3.1：创建投票表决（正常情况）

```json
{
  "communityId": "community_001",
  "type": "vote",
  "title": "关于小区增设充电桩的表决",
  "detail": "为满足业主新能源汽车充电需求，拟在地下车库增设20个充电桩。预算50万元，从公共维修基金支出。",
  "attachment": "cloud://xxx/proposal.pdf",
  "attachmentName": "充电桩建设方案.pdf",
  "initiator": "业委会",
  "publishTime": "2026-01-01T00:00:00.000Z",
  "deadlineTime": "2026-01-07T23:59:59.999Z",
  "description": "根据《物业管理条例》，需三分之二以上业主同意。",
  "showResult": true
}
```

**预期结果：**

```json
{
  "success": true,
  "voteId": "vote_xxx",
  "message": "投票创建成功"
}
```

---

### 测试用例 3.2：创建问卷调查

```json
{
  "communityId": "community_001",
  "type": "survey",
  "title": "小区物业服务满意度调查",
  "detail": "为了更好地改进物业服务质量，请您填写本次满意度调查问卷。",
  "initiator": "物业公司",
  "publishTime": "2026-01-01T00:00:00.000Z",
  "deadlineTime": "2026-01-10T23:59:59.999Z",
  "showResult": false
}
```

**预期结果：** 成功创建问卷调查

---

### 测试用例 3.3：立即发布的投票（默认发布时间）

```json
{
  "communityId": "community_001",
  "type": "vote",
  "title": "关于调整物业费的表决",
  "detail": "当前物业费标准已实施5年，拟上调20%至每月3.6元/平米。",
  "initiator": "业委会",
  "deadlineTime": "2026-01-15T23:59:59.999Z"
}
```

**预期结果：** 投票以当前时间立即发布

---

### 测试用例 3.4：缺少必填字段（异常情况）

```json
{
  "communityId": "community_001",
  "type": "vote"
}
```

**预期结果：**

```json
{
  "success": false,
  "error": "communityId, type, title and detail are required"
}
```

---

### 测试用例 3.5：创建长期投票（自定义截止时间）

```json
{
  "communityId": "community_001",
  "type": "vote",
  "title": "小区五年规划意见征集",
  "detail": "请业主对小区未来五年的发展规划提出意见和建议。",
  "initiator": "业委会",
  "deadlineTime": "2026-03-01T23:59:59.999Z",
  "showResult": true
}
```

**预期结果：** 成功创建长期投票

---

## 4. listVotes（获取投票列表）

### 测试用例 4.1：获取某社区所有投票

```json
{
  "communityId": "community_001"
}
```

**预期结果：**

```json
{
  "success": true,
  "total": 10,
  "votes": [
    {
      "_id": "vote_001",
      "title": "关于小区增设充电桩的表决",
      "type": "vote",
      "status": "active",
      "publishTime": "2026-01-01T00:00:00.000Z",
      "deadlineTime": "2026-01-07T23:59:59.999Z"
    }
  ]
}
```

---

### 测试用例 4.2：按类型筛选（仅投票表决）

```json
{
  "communityId": "community_001",
  "type": "vote"
}
```

**预期结果：** 返回所有投票表决，不包含问卷调查

---

### 测试用例 4.3：按类型筛选（仅问卷调查）

```json
{
  "communityId": "community_001",
  "type": "survey"
}
```

**预期结果：** 返回所有问卷调查

---

### 测试用例 4.4：按标题模糊搜索

```json
{
  "communityId": "community_001",
  "title": "充电桩"
}
```

**预期结果：** 返回标题中包含"充电桩"的投票

---

### 测试用例 4.5：按发起人筛选

```json
{
  "communityId": "community_001",
  "initiator": "业委会"
}
```

**预期结果：** 返回所有由业委会发起的投票

---

### 测试用例 4.6：按发布时间范围筛选

```json
{
  "communityId": "community_001",
  "publishTimeStart": "2026-01-01T00:00:00.000Z",
  "publishTimeEnd": "2026-01-31T23:59:59.999Z"
}
```

**预期结果：** 返回 2026 年 1 月发布的所有投票

---

### 测试用例 4.7：按截止时间范围筛选

```json
{
  "communityId": "community_001",
  "deadlineTimeStart": "2026-01-01T00:00:00.000Z",
  "deadlineTimeEnd": "2026-01-15T23:59:59.999Z"
}
```

**预期结果：** 返回截止时间在指定范围内的投票

---

### 测试用例 4.8：组合条件筛选

```json
{
  "communityId": "community_001",
  "type": "vote",
  "initiator": "业委会",
  "title": "表决"
}
```

**预期结果：** 返回符合所有条件的投票

---

### 测试用例 4.9：获取所有社区的投票（不指定 communityId）

```json
{}
```

**预期结果：** 返回所有社区的投票列表

---

## 5. getVoteDetail（获取投票详情）

### 测试用例 5.1：获取投票详情（用户未投票）

```json
{
  "voteId": "vote_001"
}
```

**预期结果：**

```json
{
  "success": true,
  "vote": {
    "_id": "vote_001",
    "communityId": "community_001",
    "type": "vote",
    "title": "关于小区增设充电桩的表决",
    "detail": "为满足业主新能源汽车充电需求...",
    "attachment": "cloud://xxx/proposal.pdf",
    "attachmentName": "充电桩建设方案.pdf",
    "initiator": "业委会",
    "publishTime": "2026-01-01T00:00:00.000Z",
    "deadlineTime": "2026-01-07T23:59:59.999Z",
    "description": "根据《物业管理条例》，需三分之二以上业主同意。",
    "showResult": true,
    "status": "ongoing",
    "statusText": "进行中",
    "options": []
  },
  "hasVoted": false,
  "myRecord": null,
  "statistics": {
    "totalUsers": 100,
    "votedUsers": 45,
    "participation": "45.00%"
  }
}
```

---

### 测试用例 5.2：获取投票详情（用户已投票）

```json
{
  "voteId": "vote_001"
}
```

**说明：** 需要先用该用户的 openid 调用过投票接口

**预期结果：**

```json
{
  "success": true,
  "vote": { ... },
  "hasVoted": true,
  "myRecord": {
    "choice": "agree",
    "votedAt": "2026-01-02T10:30:00.000Z"
  },
  "statistics": { ... }
}
```

---

### 测试用例 5.3：获取已结束的投票

```json
{
  "voteId": "vote_old_001"
}
```

**说明：** 该投票的截止时间已过

**预期结果：**

```json
{
  "success": true,
  "vote": {
    ...
    "status": "ended",
    "statusText": "已结束"
  },
  "hasVoted": true,
  "statistics": {
    "totalUsers": 100,
    "votedUsers": 78,
    "participation": "78.00%",
    "agree": 60,
    "disagree": 10,
    "abstain": 8
  }
}
```

---

### 测试用例 5.4：获取已暂停的投票

```json
{
  "voteId": "vote_paused_001"
}
```

**说明：** 该投票状态为 paused

**预期结果：**

```json
{
  "success": true,
  "vote": {
    ...
    "status": "paused",
    "statusText": "已暂停"
  },
  "hasVoted": false
}
```

---

### 测试用例 5.5：投票 ID 不存在（异常情况）

```json
{
  "voteId": "invalid_vote_id"
}
```

**预期结果：**

```json
{
  "success": false,
  "error": "投票不存在"
}
```

---

### 测试用例 5.6：缺少 voteId 参数（异常情况）

```json
{}
```

**预期结果：**

```json
{
  "success": false,
  "error": "voteId is required"
}
```

---

## 测试顺序建议

建议按以下顺序进行测试，以建立完整的数据流：

1. **wechatLogin** - 创建测试用户
2. **submitBinding** - 提交房屋绑定申请
3. **createVote** - 创建测试投票
4. **listVotes** - 验证投票列表
5. **getVoteDetail** - 查看投票详情

---

## 注意事项

1. **OpenID 获取**：在小程序环境中，`cloud.getWXContext()` 会自动获取 openid。在云函数测试中需要手动传入测试用的 openid。

2. **时间格式**：所有时间参数使用 ISO 8601 格式字符串（如：`2026-01-01T00:00:00.000Z`）。

3. **数据持久化**：云函数测试会真实写入数据库，测试后注意清理测试数据。

4. **权限验证**：某些云函数可能需要验证用户权限，测试前确保测试用户有相应权限。

5. **环境变量**：确认云函数已正确配置云开发环境 ID。

---

## 快速清理测试数据

测试完成后，可在云开发控制台数据库中执行以下操作清理测试数据：

1. 删除 `users` 集合中 openid 以 `test_` 开头的记录
2. 删除 `bindings` 集合中关联测试用户的记录
3. 删除 `votes` 集合中 communityId 为 `community_001` 的测试投票
4. 删除 `vote_records` 集合中关联测试投票的记录
