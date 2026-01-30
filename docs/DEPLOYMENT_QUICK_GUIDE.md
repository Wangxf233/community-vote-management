# 快速部署指南

## 一、云函数部署

### 1. 上传修改后的云函数

使用微信开发者工具或命令行上传以下云函数：

```bash
# 必须上传的云函数（已修改）
- adminCreateCommunity      # 支持address字段和软删除标记
- adminUpdateCommunity      # 更新小区信息
- adminDeleteCommunity      # 改为软删除
- adminListCommunities      # 过滤已删除记录

# 新增的云函数
- cleanupDeletedCommunities # 定时清理任务
- migrateCommunityFields    # 数据库迁移（一次性执行）
```

### 2. 配置定时触发器

在微信云开发控制台：

1. 进入【云开发】->【云函数】
2. 找到 `cleanupDeletedCommunities`
3. 点击【触发器】->【添加触发器】
4. 配置：
   - 名称: `cleanupDeletedCommunitiesTimer`
   - 类型: 定时触发器
   - 触发周期: `0 0 2 * * * *` (每天凌晨2点)
5. 点击【确定】并启用

### 3. 执行数据库迁移

在微信云开发控制台：

1. 进入【云开发】->【云函数】
2. 找到 `migrateCommunityFields`
3. 点击【测试】
4. 输入空对象 `{}`
5. 点击【运行测试】
6. 查看日志确认迁移成功

## 二、后端服务部署

### 1. 更新代码

```bash
cd admin
git pull  # 或手动更新代码
```

### 2. 安装依赖（如有新增）

```bash
npm install
```

### 3. 重启服务

```bash
# 如果使用 PM2
pm2 restart admin

# 或直接运行
node server.js
```

## 三、前端部署

### 1. 构建前端

```bash
cd admin-frontend
npm install  # 如有新依赖
npm run build
```

### 2. 部署静态文件

将 `dist` 目录部署到服务器或 CDN。

## 四、验证部署

### 1. 测试详细地址功能

- [ ] 创建新小区时能输入详细地址
- [ ] 小区列表显示详细地址列
- [ ] 编辑小区时能修改详细地址

### 2. 测试软删除功能

- [ ] 删除小区后提示"数据将保留1个月后彻底删除"
- [ ] 列表中不再显示已删除的小区
- [ ] 数据库中记录仍存在，deleted=true

### 3. 测试定时清理

- [ ] 手动触发 `cleanupDeletedCommunities` 云函数
- [ ] 检查日志输出
- [ ] 确认30天前删除的数据被清理

### 4. 测试到期提醒

- [ ] 创建即将到期的小区（14天内）
- [ ] 以该小区管理员登录
- [ ] 顶部显示续费提醒

## 五、回滚方案

如果部署出现问题，可以快速回滚：

### 回滚云函数

1. 在云开发控制台查看云函数历史版本
2. 选择之前的版本进行回滚

### 回滚后端服务

```bash
cd admin
git checkout <previous-commit>
pm2 restart admin
```

### 回滚前端

重新部署之前的 dist 目录。

## 六、监控和维护

### 1. 检查定时任务执行

定期查看 `cleanupDeletedCommunities` 的执行日志：

- 云开发控制台 -> 云函数 -> cleanupDeletedCommunities -> 日志

### 2. 数据库备份

建议每周备份一次 communities 集合：

```bash
# 使用云开发提供的备份功能
# 或导出数据到本地
```

### 3. 性能监控

- 监控 API 响应时间
- 监控数据库查询性能
- 监控云函数执行时长

## 七、常见问题

### Q1: 迁移后旧数据没有 address 字段怎么办？

A: 重新执行 `migrateCommunityFields` 云函数。

### Q2: 删除的小区能否恢复？

A: 可以，30天内通过数据库手动修改：

```javascript
db.collection("communities")
  .doc("小区ID")
  .update({
    data: { deleted: false, deletedAt: null },
  });
```

### Q3: 定时任务没有执行？

A: 检查触发器配置是否启用，查看云函数日志排查问题。

### Q4: 列表仍显示已删除的小区？

A: 检查 `adminListCommunities` 云函数是否正确部署，清除浏览器缓存。

## 联系方式

如有问题请联系技术支持。
