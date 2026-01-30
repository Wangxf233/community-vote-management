# 后端功能实现说明

## 已实现功能

### 1. 详细地址字段支持

#### 云函数修改

- **adminCreateCommunity**: 添加了 `address` 字段和软删除标记 `deleted`、`deletedAt`
- 创建小区时会保存详细地址信息

#### 路由修改

- **GET /api/communities**: 查询时自动过滤已删除的记录 (`deleted !== true`)

### 2. 软删除功能

#### adminDeleteCommunity 云函数

- 原来的硬删除改为软删除
- 设置 `deleted: true` 和 `deletedAt: 当前时间`
- 数据保留，不立即从数据库删除

#### 新增定时清理云函数

- **cloudfunctions/cleanupDeletedCommunities**
  - 每天凌晨2点执行 (cron: `0 0 2 * * * *`)
  - 查找 `deleted=true` 且 `deletedAt` 超过30天的小区
  - 彻底删除小区及其所有管理员账号
  - 提供详细的执行日志

### 3. 查询过滤

#### adminListCommunities 云函数

- 添加了 `baseWhere.deleted = db.command.neq(true)` 过滤条件
- 确保列表查询不返回已删除的小区

#### admin/routes/community.js

- GET /communities 路由添加了软删除过滤

## 部署步骤

### 1. 上传云函数

```bash
# 进入云函数目录
cd cloudfunctions

# 上传修改后的云函数
# adminCreateCommunity - 创建小区支持address和软删除标记
# adminUpdateCommunity - 更新小区信息
# adminDeleteCommunity - 软删除功能
# adminListCommunities - 过滤已删除记录
# cleanupDeletedCommunities - 定时清理任务（新增）

# 使用微信开发者工具或云开发CLI上传
```

### 2. 配置定时触发器

在微信云开发控制台：

1. 进入【云开发】->【云函数】
2. 找到 `cleanupDeletedCommunities` 函数
3. 配置定时触发器:
   - 触发器名称: `cleanupDeletedCommunitiesTimer`
   - 触发周期: `0 0 2 * * * *` (每天凌晨2点)
   - 启用触发器

### 3. 数据库迁移

对于现有数据，需要添加新字段：

```javascript
// 在云开发控制台或通过云函数执行
db.collection("communities")
  .where({})
  .update({
    data: {
      address: db.command.exists(false) ? "" : db.command.remove(),
      deleted: db.command.exists(false) ? false : db.command.remove(),
      deletedAt: db.command.exists(false) ? null : db.command.remove(),
    },
  });
```

或者更安全的方式，逐个更新：

```javascript
const communities = await db.collection("communities").get();
for (const community of communities.data) {
  if (!community.hasOwnProperty("address")) {
    await db
      .collection("communities")
      .doc(community._id)
      .update({
        data: {
          address: "",
          deleted: false,
          deletedAt: null,
        },
      });
  }
}
```

### 4. 重启后端服务

```bash
cd admin
npm install  # 如果有新依赖
node server.js  # 或使用 pm2 restart
```

## 数据库字段说明

### communities 集合新增字段

| 字段名    | 类型    | 说明                                 |
| --------- | ------- | ------------------------------------ |
| address   | String  | 详细地址（街道等信息）               |
| deleted   | Boolean | 是否已删除 (false=正常, true=已删除) |
| deletedAt | Date    | 删除时间 (未删除时为null)            |

## API 变更

### POST /api/communities

**新增请求字段:**

- `address`: 详细地址（可选）

**示例:**

```json
{
  "name": "花园小区",
  "region": ["广东省", "深圳市", "南山区"],
  "address": "科技园南路123号",
  "ownerName": "张三",
  "ownerPhone": "13800138000",
  "startDate": "2026-01-01",
  "endDate": "2027-01-01"
}
```

### PUT /api/communities/:id

**新增请求字段:**

- `address`: 详细地址（可选）

**软删除:**

```json
{
  "deleted": true,
  "deletedAt": "2026-01-23T10:30:00.000Z"
}
```

### GET /api/communities

**响应变更:**

- 自动过滤 `deleted=true` 的记录
- 返回数据包含 `address` 字段

## 测试建议

### 1. 测试详细地址功能

- 创建新小区时填写详细地址
- 查看列表是否显示详细地址
- 编辑小区信息修改详细地址

### 2. 测试软删除功能

- 删除一个小区
- 检查数据库中 `deleted` 和 `deletedAt` 字段
- 确认列表中不再显示该小区
- 确认数据仍在数据库中

### 3. 测试定时清理

- 手动修改某个已删除小区的 `deletedAt` 为31天前
- 手动触发 `cleanupDeletedCommunities` 云函数
- 检查该小区及其管理员是否被彻底删除

### 4. 测试到期提醒

- 创建一个到期时间在14天内的小区
- 以该小区管理员身份登录
- 检查顶部是否显示续费提醒

## 注意事项

1. **定时任务执行频率**: 建议设置为每天凌晨2-4点执行，避免高峰期
2. **数据备份**: 在定时清理前建议做好数据库备份
3. **日志监控**: 定期检查 `cleanupDeletedCommunities` 的执行日志
4. **权限控制**: 软删除操作需要超级管理员权限
5. **恢复机制**: 如需恢复已删除数据，可在30天内手动修改 `deleted=false`

## 恢复已删除的小区

如果需要恢复30天内被删除的小区：

```javascript
// 在云开发控制台执行
db.collection("communities")
  .doc("小区ID")
  .update({
    data: {
      deleted: false,
      deletedAt: null,
    },
  });
```
