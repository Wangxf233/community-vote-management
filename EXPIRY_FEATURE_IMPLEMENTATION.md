# 通知有效期功能实现说明

## 功能概述

为通知公告系统添加了有效期功能，支持以下特性：

- 预设有效期选项：1 天、3 天、7 天
- 自定义有效期时间
- 自动过期检查和状态更新
- 小程序端自动隐藏过期通知

## 前端改动

### 文件：`admin-frontend/src/pages/NotificationForm.vue`

**新增字段：**

- `expiryType`: 有效期类型（1day/3days/7days/custom）
- `form.expiryDays`: 有效期天数
- `form.expiryTime`: 自定义有效期截止时间

**新增功能：**

1. 有效期时间选择器（预设选项 + 自定义）
2. 有效期日期验证（必须晚于发布时间）
3. 有效期提示信息显示
4. 编辑时加载和保存有效期设置

## 后端改动

### 文件：`admin/routes/announcement.js`

**新增工具函数：**

```javascript
// 计算有效期截止时间
function calculateExpiryTime(announcement) {
  if (announcement.expiryTime) {
    return new Date(announcement.expiryTime);
  }
  if (announcement.expiryDays && announcement.publishTime) {
    const publishTime = new Date(announcement.publishTime);
    return new Date(
      publishTime.getTime() + announcement.expiryDays * 24 * 60 * 60 * 1000
    );
  }
  return null;
}

// 检查并更新过期的通知
async function checkAndUpdateExpiredAnnouncements() {
  // 每小时自动检查一次，将过期通知状态更新为 "expired"
}
```

**修改的 API 端点：**

1. **GET /announcements** - 获取列表

   - 返回数据增加 `actualStatus` 字段（实时计算是否过期）

2. **POST /announcements** - 创建通知

   - 接收 `expiryDays` 和 `expiryTime` 参数
   - 保存到数据库

3. **PUT /announcements/:id** - 更新通知

   - 支持更新 `expiryDays` 和 `expiryTime`

4. **GET /announcements/:id** - 获取详情
   - 返回 `actualStatus` 字段

**定时任务：**

- 每小时自动检查过期通知
- 自动将过期通知的 `status` 更新为 `"expired"`

## 小程序端改动

### 文件：`cloudfunctions/listAnnouncements/index.js`

**修改内容：**

- 添加 `calculateExpiryTime()` 函数
- 在返回列表前过滤掉已过期的通知
- 只返回未过期的通知给小程序用户

### 文件：`cloudfunctions/getAnnouncementDetail/index.js`

**修改内容：**

- 添加 `calculateExpiryTime()` 函数
- 在返回详情前检查是否过期
- 如果已过期，返回错误提示

### 文件：`cloudfunctions/getUnreadAnnouncementCount/index.js`

**修改内容：**

- 添加 `calculateExpiryTime()` 函数
- 在计算未读数量时过滤掉已过期的通知
- 只统计未过期的通知

## 数据库字段

在 `announcements` 集合中新增字段：

```javascript
{
  expiryDays: Number,      // 有效期天数（1/3/7），如果使用预设选项
  expiryTime: Date,        // 自定义有效期截止时间，如果选择自定义
  status: String,          // 状态：published/scheduled/expired
  // ... 其他已有字段
}
```

## 状态说明

通知状态（`status`）包括：

- `scheduled`: 定时发布（发布时间在未来）
- `published`: 已发布（正常显示）
- `expired`: 已到期（后台显示，小程序不显示）

实际状态（`actualStatus`）由前端实时计算：

- 如果 `status === "published"` 且当前时间超过有效期，则 `actualStatus = "expired"`

## 使用说明

1. **创建通知时：**

   - 选择有效期类型（1 天/3 天/7 天/自定义）
   - 如果选择自定义，选择具体的截止时间
   - 系统会自动保存 `expiryDays` 或 `expiryTime`

2. **编辑通知时：**

   - 可以修改有效期设置
   - 有效期时间必须晚于发布时间

3. **自动过期：**

   - 后端每小时检查一次过期通知
   - 自动将过期通知状态更新为 `expired`
   - 小程序端实时过滤过期通知，不显示给用户

4. **后台管理：**
   - 列表中显示 `actualStatus` 状态
   - 可以看到"已到期"的通知
   - 已到期的通知不会在小程序端显示

## 测试建议

1. 创建一个 1 天有效期的通知，验证小程序端显示
2. 等待 1 天后（或手动修改数据库），验证通知自动过期
3. 验证过期通知在小程序端不显示
4. 验证后台可以查看已到期的通知
5. 测试自定义有效期功能
6. 测试编辑通知时修改有效期

## 注意事项

1. 定时任务每小时执行一次，不是实时的
2. 小程序端会实时过滤过期通知，即使数据库状态未更新
3. 如果没有设置有效期（旧数据），通知会一直显示
4. 建议为所有新通知设置默认有效期（如 3 天）
