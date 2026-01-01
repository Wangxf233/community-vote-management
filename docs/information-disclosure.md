# 信息公示功能实现文档

## 功能概述

信息公示功能是一个完整的公告管理系统，包括管理后台和小程序两部分。系统支持三种类型的信息公示：

- 业委会信息公示（committee）
- 物业信息公示（property）
- 法律法规（law）

## 功能特性

### 管理后台功能

1. **三标签页分类管理**

   - 业委会信息公示
   - 物业信息公示
   - 法律法规

2. **公告管理功能**

   - 新增公告：支持立即发布和定时发布
   - 编辑公告：修改公告内容和发布时间
   - 删除公告：支持删除确认
   - 置顶功能：重要公告可置顶显示
   - 启用/禁用：控制公告是否对用户可见

3. **筛选和搜索**

   - 按标题搜索
   - 按发布人筛选
   - 按发布时间范围筛选

4. **文件上传**

   - 支持上传图片（jpg、png，最大 10MB）
   - 支持上传文档（pdf、doc、docx，最大 10MB）
   - 每个公告可上传多个附件

5. **分页显示**
   - 列表分页展示
   - 可自定义每页显示数量

### 小程序功能

1. **信息分类浏览**

   - 首页显示三个分类入口
   - 每个分类独立的列表页面
   - 支持查看全部信息

2. **未读消息提示**

   - 首页显示未读消息数量
   - 每个分类显示未读数量
   - 未读公告有红点标记

3. **公告列表**

   - 按发布时间倒序排列
   - 置顶公告显示在最前
   - 显示发布人、时间、浏览量
   - 显示附件数量

4. **公告详情**

   - 完整显示公告内容
   - 支持查看和下载附件
   - 图片附件支持预览
   - 文档附件支持下载和打开
   - 自动标记为已读
   - 自动增加浏览量

5. **新消息通知**

   - 小程序启动时检查未读公告
   - 有新公告时弹窗提醒（24 小时内最多提醒一次）
   - 可直接跳转到信息公示页面

6. **下拉刷新**
   - 支持下拉刷新列表
   - 支持上拉加载更多

## 技术实现

### 数据库设计

#### announcements 集合

```javascript
{
  _id: String,              // 公告ID
  title: String,            // 标题
  publisher: String,        // 发布人
  publishTime: Date,        // 发布时间
  content: String,          // 内容
  attachments: Array,       // 附件列表
  type: String,             // 类型：committee/property/law
  communityId: String,      // 社区ID
  status: String,           // 状态：draft/published/disabled
  isPinned: Boolean,        // 是否置顶
  viewCount: Number,        // 浏览量
  createdAt: Date,          // 创建时间
  updatedAt: Date           // 更新时间
}
```

附件对象格式：

```javascript
{
  name: String,    // 文件名
  url: String,     // 文件URL
  type: String,    // 类型：image/document
  size: Number     // 文件大小（字节）
}
```

#### announcement_reads 集合

```javascript
{
  _id: String,              // 记录ID
  openid: String,           // 用户openid
  announcementId: String,   // 公告ID
  readAt: Date              // 阅读时间
}
```

### 后端 API

#### 基础路由：`/api/announcements`

1. **GET /** - 获取公告列表

   - 查询参数：
     - `communityId`: 社区 ID（必填）
     - `type`: 类型筛选（可选）
     - `title`: 标题搜索（可选）
     - `publisher`: 发布人筛选（可选）
     - `startDate`: 开始日期（可选）
     - `endDate`: 结束日期（可选）
     - `page`: 页码（默认 1）
     - `pageSize`: 每页数量（默认 10）

2. **POST /** - 创建公告

   - 请求体：
     ```javascript
     {
       title: String,
       publisher: String,
       publishTime: Date,
       content: String,
       attachments: Array,
       type: String,
       communityId: String,
       publishNow: Boolean  // true=立即发布，false=定时发布
     }
     ```

3. **GET /:id** - 获取公告详情

   - 路径参数：id（公告 ID）

4. **PUT /:id** - 更新公告

   - 路径参数：id（公告 ID）
   - 请求体：同创建公告

5. **DELETE /:id** - 删除公告

   - 路径参数：id（公告 ID）

6. **PUT /:id/pin** - 切换置顶状态

   - 路径参数：id（公告 ID）

7. **PUT /:id/status** - 更新状态
   - 路径参数：id（公告 ID）
   - 请求体：
     ```javascript
     {
       status: String; // published/disabled
     }
     ```

### 云函数

#### listAnnouncements

获取公告列表，包含已读状态

**输入参数：**

```javascript
{
  communityId: String,  // 必填
  type: String,         // 可选
  page: Number,         // 默认1
  pageSize: Number      // 默认10
}
```

**返回数据：**

```javascript
{
  success: Boolean,
  data: {
    list: Array,      // 公告列表
    total: Number,    // 总数
    page: Number,     // 当前页
    pageSize: Number  // 每页数量
  }
}
```

#### getAnnouncementDetail

获取公告详情并标记为已读

**输入参数：**

```javascript
{
  announcementId: String; // 必填
}
```

**返回数据：**

```javascript
{
  success: Boolean,
  data: Object  // 公告详情
}
```

#### markAnnouncementRead

手动标记公告为已读

**输入参数：**

```javascript
{
  announcementId: String; // 必填
}
```

**返回数据：**

```javascript
{
  success: Boolean,
  message: String
}
```

#### getUnreadAnnouncementCount

获取未读公告数量

**输入参数：**

```javascript
{
  communityId: String,  // 必填
  type: String          // 可选，指定类型
}
```

**返回数据：**

```javascript
{
  success: Boolean,
  data: {
    total: Number,        // 总公告数
    unreadCount: Number,  // 未读数量
    byType: {
      committee: Number,  // 业委会未读数
      property: Number,   // 物业未读数
      law: Number         // 法律法规未读数
    }
  }
}
```

## 文件结构

### 管理后台

```
admin/
├── routes/
│   └── announcement.js              # 公告路由
└── server.js                         # Express服务器配置

admin-frontend/
└── src/
    ├── pages/
    │   └── AnnouncementManagement/
    │       ├── index.vue             # 主页面（三标签页）
    │       ├── AnnouncementList.vue  # 列表组件
    │       └── AnnouncementForm.vue  # 表单组件
    ├── router.ts                     # 路由配置
    └── layouts/
        └── CommunityAdminLayout.vue  # 菜单配置
```

### 云函数

```
cloudfunctions/
├── listAnnouncements/
│   ├── index.js
│   └── package.json
├── getAnnouncementDetail/
│   ├── index.js
│   └── package.json
├── markAnnouncementRead/
│   ├── index.js
│   └── package.json
└── getUnreadAnnouncementCount/
    ├── index.js
    └── package.json
```

### 小程序

```
miniprogram/
├── app.js                            # 应用入口（添加未读检查）
├── app.json                          # 应用配置（更新标签文字）
└── pages/
    ├── information/
    │   ├── index.js                  # 信息首页
    │   ├── index.wxml
    │   ├── index.wxss
    │   └── index.json
    ├── information-list/
    │   ├── index.js                  # 列表页
    │   ├── index.wxml
    │   ├── index.wxss
    │   └── index.json
    └── information-detail/
        ├── index.js                  # 详情页
        ├── index.wxml
        ├── index.wxss
        └── index.json
```

## 使用流程

### 管理后台操作流程

1. **发布公告**

   - 登录管理后台
   - 进入"信息公示"菜单
   - 选择对应的标签页（业委会/物业/法律法规）
   - 点击"新增公告"按钮
   - 填写标题、选择发布人、设置发布时间
   - 填写内容、上传附件（可选）
   - 选择"立即发布"或"定时发布"
   - 点击"提交"

2. **管理公告**

   - 在列表中可以：
     - 查看详情
     - 编辑公告
     - 置顶/取消置顶
     - 启用/禁用
     - 删除公告

3. **筛选公告**
   - 使用搜索框按标题搜索
   - 使用下拉框按发布人筛选
   - 使用日期选择器按时间范围筛选
   - 点击"搜索"应用筛选条件
   - 点击"重置"清除所有筛选

### 小程序用户流程

1. **查看公告**

   - 打开小程序，进入"信息公示"标签页
   - 首页显示三个分类和未读消息提示
   - 点击分类进入对应列表
   - 或点击"新消息"查看全部未读

2. **浏览列表**

   - 列表显示所有公告
   - 置顶公告显示在最前
   - 未读公告有红点标记
   - 下拉可刷新列表
   - 上拉可加载更多

3. **查看详情**

   - 点击公告进入详情页
   - 查看完整内容
   - 点击图片附件可预览
   - 点击文档附件可下载
   - 下载后可在微信中打开

4. **接收通知**
   - 小程序启动时自动检查未读
   - 有新公告时弹窗提醒
   - 点击"查看"直接跳转到信息公示页面
   - 点击"稍后"关闭提醒（24 小时内不再提示）

## 注意事项

1. **权限控制**

   - 只有已认证通过的业主才能查看公告
   - 未认证用户会提示先完成认证

2. **文件上传限制**

   - 图片格式：jpg、png
   - 文档格式：pdf、doc、docx
   - 单个文件最大：10MB

3. **通知频率控制**

   - 新消息通知每 24 小时最多提示一次
   - 避免频繁打扰用户

4. **性能优化**

   - 列表采用分页加载
   - 支持上拉加载更多
   - 图片懒加载

5. **数据同步**
   - 下拉刷新获取最新数据
   - 查看详情时实时更新浏览量
   - 已读状态实时同步

## 未来扩展建议

1. **评论功能**

   - 用户可以对公告进行评论
   - 管理员可以回复评论

2. **通知订阅**

   - 用户可选择订阅特定类型的公告
   - 通过微信模板消息推送

3. **富文本编辑**

   - 支持更丰富的内容格式
   - 支持插入图片、表格等

4. **版本历史**

   - 记录公告的修改历史
   - 可查看历史版本

5. **统计分析**

   - 公告阅读统计
   - 用户活跃度分析

6. **导出功能**
   - 支持导出公告列表
   - 支持导出公告详情为 PDF

## 部署说明

### 管理后台部署

1. 确保已安装依赖：

   ```bash
   cd admin
   npm install
   cd ../admin-frontend
   npm install
   ```

2. 启动后端服务：

   ```bash
   cd admin
   node server.js
   ```

3. 启动前端开发服务：
   ```bash
   cd admin-frontend
   npm run dev
   ```

### 云函数部署

1. 在微信开发者工具中打开小程序项目

2. 右键每个云函数文件夹，选择"上传并部署：云端安装依赖"

   - listAnnouncements
   - getAnnouncementDetail
   - markAnnouncementRead
   - getUnreadAnnouncementCount

3. 等待部署完成

### 小程序发布

1. 在微信开发者工具中点击"上传"
2. 填写版本号和更新说明
3. 在微信公众平台提交审核
4. 审核通过后发布

## 更新日志

### v1.0.0 (2025-01-XX)

**初始版本**

- ✅ 实现三种类型的信息公示
- ✅ 管理后台完整 CRUD 功能
- ✅ 文件上传和附件管理
- ✅ 小程序公告浏览和详情查看
- ✅ 未读消息统计和提醒
- ✅ 已读状态跟踪
- ✅ 浏览量统计
- ✅ 置顶功能
- ✅ 启用/禁用控制
- ✅ 定时发布功能

---

**开发团队**

- 功能设计：AI Assistant
- 技术实现：AI Assistant
- 文档编写：AI Assistant

**技术栈**

- 后端：Node.js + Express
- 前端：Vue 3 + TypeScript + Element Plus
- 小程序：微信小程序原生框架
- 数据库：腾讯云数据库
- 云服务：微信云开发
