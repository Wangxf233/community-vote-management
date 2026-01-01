# 后端代码重构指南

## 当前状态

已完成基础框架搭建：

- ✅ `config/db.js` - 数据库配置
- ✅ `utils/helpers.js` - 工具函数
- ✅ `middleware/auth.js` - 认证中间件
- ✅ `routes/auth.js` - 认证路由（登录相关）

当前 `server.js` (2353 行) 保持不变，所有功能正常运行。

## 重构策略

采用**渐进式重构**，不影响现有功能：

### 第一阶段：创建路由模块（进行中）

需要创建以下路由文件：

1. **routes/owner.js** - 业主相关

   - GET /api/owner-registry - 获取业主名册列表
   - POST /api/owner-registry - 添加单个业主
   - POST /api/owner-registry/import - 批量导入
   - PUT /api/owner-registry/:id - 更新业主信息
   - DELETE /api/owner-registry/:id - 删除业主
   - GET /api/owner-list - 获取户主列表
   - PUT /api/owner-list/:id - 更新户主信息
   - DELETE /api/owner-list/:id - 删除户主
   - POST /api/owner-list/:id/verify - 实名认证

2. **routes/community.js** - 小区管理

   - GET /api/communities - 获取小区列表
   - POST /api/communities - 创建小区
   - PUT /api/communities/:id - 更新小区
   - DELETE /api/communities/:id - 删除小区
   - POST /api/communities/:id/admins - 创建小区管理员
   - PUT /api/communities/:id/admins/:adminId - 更新管理员
   - DELETE /api/communities/:id/admins/:adminId - 删除管理员

3. **routes/certification.js** - 认证审核

   - GET /api/certifications - 获取认证列表
   - GET /api/certifications/:id - 获取单个认证
   - PATCH /api/certifications/:id - 审核认证（通过/拒绝）

4. **routes/vote.js** - 投票管理

   - GET /api/votes - 获取投票列表
   - POST /api/votes - 创建投票
   - GET /api/votes/:id - 获取投票详情
   - PUT /api/votes/:id - 更新投票
   - DELETE /api/votes/:id - 删除投票
   - POST /api/votes/:id/publish - 发布投票
   - DELETE /api/votes/:id/publish - 取消发布

5. **routes/binding.js** - 绑定管理（可选）
   - GET /api/bindings - 获取绑定列表
   - GET /api/bindings/:id - 获取单个绑定
   - PATCH /api/bindings/:id - 审核绑定

### 第二阶段：修改 server.js

在 server.js 中：

1. 引入新的配置和中间件
2. 挂载新的路由模块
3. 逐步注释掉已迁移的旧路由代码

示例：

```javascript
const express = require("express");
const bodyParser = require("body-parser");
const { tcb, db } = require("./config/db");
const authRoutes = require("./routes/auth");
const ownerRoutes = require("./routes/owner");
const communityRoutes = require("./routes/community");

const app = express();
app.use(bodyParser.json());

// CORS配置
app.use((req, res, next) => {
  // ...CORS代码...
});

// 挂载路由
app.use("/api", authRoutes);
app.use("/api", ownerRoutes);
app.use("/api", communityRoutes);

// ...其他未迁移的路由...

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

### 第三阶段：测试验证

每迁移一个模块后：

1. 启动服务器
2. 测试对应的前端功能
3. 确认无误后继续迁移下一个模块

## 优势

1. **代码分离** - 每个功能模块独立，易于维护
2. **便于协作** - 团队成员可以并行开发不同模块
3. **可测试性** - 每个模块可以单独测试
4. **可扩展性** - 添加新功能只需创建新的路由文件

## 下一步行动

1. 继续创建 `routes/owner.js` 等路由文件
2. 完成所有路由模块的创建
3. 修改 server.js 引入新模块
4. 逐个测试验证功能

## 注意事项

- 重构期间，原 server.js 保持不变，确保系统稳定运行
- 完成所有路由迁移并测试通过后，再删除 server.js 中的旧代码
- 保留一份 server.js 的备份，以防需要回滚
