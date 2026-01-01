# 报修管理功能实现说明

## 已完成的功能

### 1. 后端 API (admin/routes/repair.js)

创建了完整的报修管理路由模块，包含以下接口：

- **GET /api/repairs** - 获取报修/报事列表

  - 支持分页查询
  - 支持按类型筛选（repair/report）
  - 支持按设备、地点、时间、紧急状态、进度筛选
  - 社区管理员只能查看自己社区的报修

- **POST /api/repairs** - 创建报修/报事

  - 自动关联 communityId
  - 区分报修和报事类型
  - 支持图片和视频附件

- **PUT /api/repairs/:id** - 更新报修状态或备注

  - 可修改处理进度（未处理/处理中/已完成）
  - 可添加或修改备注
  - 权限控制：社区管理员只能管理自己社区的报修

- **DELETE /api/repairs/:id** - 删除报修（仅超级管理员）

### 2. 小程序提交逻辑 (miniprogram/pages/repair/index.js)

修改了小程序的报修提交功能：

- ✅ 获取用户绑定的 communityId，确保报修与社区关联
- ✅ 报修和报事分别调用 submitRepair 云函数
- ✅ 真实的文件上传逻辑（图片、视频上传到云存储）
- ✅ 提交成功后清空表单并刷新进度列表

### 3. 云函数 (cloudfunctions/submitRepair/)

创建了 submitRepair 云函数：

- 接收小程序提交的报修/报事数据
- 调用管理后台 API 创建记录
- 自动传递 communityId、userId、userName 等信息

**注意**：需要在云开发控制台上传并部署此云函数，并安装依赖（axios）。

### 4. 管理后台页面 (admin-frontend/src/pages/repairManagement.vue)

实现了完整的报修管理界面：

#### 报修子页面

- ✅ 列表显示：报修设备、地点、描述、图片、视频、提交时间、是否紧急、进度、备注
- ✅ 筛选功能：支持按设备、地点、时间、紧急状态、进度筛选
- ✅ 图片预览：点击图片可以查看大图，支持多图预览
- ✅ 视频预览：点击"预览"按钮可以播放视频
- ✅ 描述悬浮：内容过长时悬浮显示完整内容
- ✅ 修改进度：弹窗修改处理进度
- ✅ 添加备注：弹窗添加或修改备注
- ✅ 分页显示：支持 10/20/50/100 条每页

#### 报事子页面

- ✅ 列表显示：事项、描述、图片、视频、提交时间、是否紧急、进度、备注
- ✅ 筛选功能：支持按事项、时间、紧急状态、进度筛选
- ✅ 其他功能与报修子页面相同

## 数据库结构

### repairs 集合

```javascript
{
  _id: string,              // 记录ID
  type: string,             // 类型: 'repair' | 'report'
  communityId: string,      // 社区ID
  equipment: string,        // 报修设备（仅报修）
  location: string,         // 地点（仅报修）
  title: string,            // 事项标题（仅报事）
  description: string,      // 描述
  images: string[],         // 图片URL数组
  video: string,            // 视频URL
  isUrgent: boolean,        // 是否紧急
  status: string,           // 状态: 'pending' | 'processing' | 'completed'
  remark: string,           // 备注
  userId: string,           // 提交用户ID
  userName: string,         // 提交用户姓名
  submitTime: Date,         // 提交时间
  updatedAt: Date          // 更新时间
}
```

## 部署步骤

### 1. 部署后端

后端路由已自动挂载到 server.js，重启服务即可：

```bash
cd admin
node server.js
```

### 2. 部署云函数

```bash
# 在微信开发者工具中：
# 1. 右键 cloudfunctions/submitRepair
# 2. 选择"上传并部署：云端安装依赖"
```

### 3. 配置环境变量

在云函数的环境变量中配置：

- `ADMIN_API_BASE`: 管理后台 API 地址（如 http://your-domain.com 或 http://localhost:3000）

### 4. 启动前端

```bash
cd admin-frontend
npm run dev
```

## 测试流程

1. **小程序端测试**：

   - 打开小程序，进入"物业服务" -> "报修"
   - 填写报修信息（设备、地点、描述等）
   - 上传图片/视频（可选）
   - 提交报修
   - 切换到"新的报事"标签测试报事功能

2. **管理后台测试**：
   - 登录管理后台
   - 进入"报修管理"页面
   - 查看报修列表和报事列表
   - 测试筛选功能
   - 测试修改进度和添加备注功能
   - 测试图片视频预览功能

## 权限说明

- **超级管理员（super）**：可以查看所有社区的报修，可以删除记录
- **社区管理员（community/community_admin）**：只能查看和管理自己社区的报修
- **小程序用户**：必须先绑定社区才能提交报修

## 注意事项

1. 小程序提交报修时，会自动获取用户绑定的 communityId，确保数据正确关联
2. 图片和视频上传到云存储，fileID 会保存到数据库
3. 管理后台的图片预览使用 Element Plus 的 Image 组件，支持点击放大
4. 视频预览使用原生 video 标签，支持在线播放
5. 所有时间显示都格式化为本地时间（年-月-日 时:分）
