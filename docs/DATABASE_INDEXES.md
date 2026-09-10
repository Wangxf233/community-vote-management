# 数据库复合索引方案

## 为什么需要复合索引

本系统为多小区架构，几乎所有查询都带 `communityId` 过滤条件。没有复合索引时，每次查询都会全集合扫描，随着小区/业主数量增长性能会线性退化。

---

## 创建方式

### 方式一：微信开发者工具 / CloudBase 控制台（推荐首次部署使用）

1. 打开 [CloudBase 控制台](https://console.cloud.tencent.com/tcb) → 选择环境 → **数据库** → 选择集合 → **索引管理** → **新增索引**
2. 按下表逐一创建

### 方式二：CloudBase CLI

```bash
# 安装 CLI（如未安装）
npm install -g @cloudbase/cli

# 登录
tcb login

# 格式：tcb db index set --envId <你的环境ID> --collection <集合名> --index <JSON>
# 示例：
tcb db index set --envId cloud1-6ghienoi526fff51 \
  --collection vote_records \
  --index '[{"name":"idx_voteId_openid","unique":true,"keys":[{"name":"voteId","direction":1},{"name":"openid","direction":1}]}]'
```

---

## 索引清单

### `vote_records`（投票记录）

| 索引名                      | 字段                              | 唯一   | 用途                                                                  |
| --------------------------- | --------------------------------- | ------ | --------------------------------------------------------------------- |
| `idx_voteId_openid`         | `voteId ASC, openid ASC`          | **是** | 防止重复投票（与代码端 `_id=${voteId}_${openid}` 双重保险）；列表查询 |
| `idx_communityId_voteId`    | `communityId ASC, voteId ASC`     | 否     | 统计查询按小区隔离                                                    |
| `idx_communityId_createdAt` | `communityId ASC, createdAt DESC` | 否     | 管理端按时间排序列表                                                  |

### `votes`（投票表决）

| 索引名                      | 字段                              | 唯一 | 用途                              |
| --------------------------- | --------------------------------- | ---- | --------------------------------- |
| `idx_communityId_status`    | `communityId ASC, status ASC`     | 否   | 按状态筛选（active/paused/ended） |
| `idx_communityId_createdAt` | `communityId ASC, createdAt DESC` | 否   | 列表排序                          |
| `idx_communityId_type`      | `communityId ASC, type ASC`       | 否   | 投票/问卷分类筛选                 |

### `owner_list`（业主名单）

| 索引名                               | 字段                                                | 唯一 | 用途                                     |
| ------------------------------------ | --------------------------------------------------- | ---- | ---------------------------------------- |
| `idx_communityId_openid`             | `communityId ASC, openid ASC`                       | 否   | 按小区查业主、统计去重 openid            |
| `idx_communityId_deleted`            | `communityId ASC, deleted ASC`                      | 否   | 过滤未删除业主（getVoteStatistics 聚合） |
| `idx_communityId_building_unit_room` | `communityId ASC, building ASC, unit ASC, room ASC` | 否   | 按楼栋/单元/房号定位业主                 |
| `idx_openid`                         | `openid ASC`                                        | 否   | 小程序端按 openid 查户主信息             |

### `announcements`（公告）

| 索引名                   | 字段                          | 唯一 | 用途                                              |
| ------------------------ | ----------------------------- | ---- | ------------------------------------------------- |
| `idx_communityId_status` | `communityId ASC, status ASC` | 否   | 按状态列表                                        |
| `idx_status_expiryTime`  | `status ASC, expiryTime ASC`  | 否   | `checkAndUpdateExpiredAnnouncements` 定时任务过滤 |

### `evaluations`（评价）

| 索引名                | 字段                       | 唯一 | 用途                                 |
| --------------------- | -------------------------- | ---- | ------------------------------------ |
| `idx_cycleId_openid`  | `cycleId ASC, openid ASC`  | 否   | 按周期批量查评价（`_.in(cycleIds)`） |
| `idx_cycleId_staffId` | `cycleId ASC, staffId ASC` | 否   | 单人评价详情查询                     |

### `evaluation_cycles`（评价周期）

| 索引名                   | 字段                          | 唯一 | 用途       |
| ------------------------ | ----------------------------- | ---- | ---------- |
| `idx_communityId_status` | `communityId ASC, status ASC` | 否   | 按状态列表 |

### `repair_requests`（报修）

| 索引名                      | 字段                              | 唯一 | 用途       |
| --------------------------- | --------------------------------- | ---- | ---------- |
| `idx_communityId_status`    | `communityId ASC, status ASC`     | 否   | 按状态列表 |
| `idx_communityId_createdAt` | `communityId ASC, createdAt DESC` | 否   | 排序列表   |

### `reports`（投诉/举报）

| 索引名                   | 字段                          | 唯一 | 用途       |
| ------------------------ | ----------------------------- | ---- | ---------- |
| `idx_communityId_status` | `communityId ASC, status ASC` | 否   | 按状态列表 |

### `certification_applications`（认证申请）

| 索引名                               | 字段                                                | 唯一 | 用途                                              |
| ------------------------------------ | --------------------------------------------------- | ---- | ------------------------------------------------- |
| `idx_communityId_type`               | `communityId ASC, type ASC`                         | 否   | 审核列表                                          |
| `idx_communityId_building_unit_room` | `communityId ASC, building ASC, unit ASC, room ASC` | 否   | 认证审核时快速匹配 owner_registry（替代全量拉取） |

---

## 优先级建议

上线前**必创建**（查询频率最高、影响最大）：

1. `vote_records` → `idx_voteId_openid`（唯一，防重复投票）
2. `owner_list` → `idx_communityId_deleted`（getVoteStatistics 聚合关键路径）
3. `owner_list` → `idx_communityId_openid`
4. `votes` → `idx_communityId_status`
5. `announcements` → `idx_status_expiryTime`（定时任务每小时触发）

---

## 关于 `_id` 设计（`vote_records`）

`updateVote` 云函数在写入投票记录时使用确定性 `_id = \`${voteId}_${openid}\``，利用 `\_id`天然唯一约束，在数据库层面阻止并发重复投票（即使无`idx_voteId_openid` 也能防重）。但仍建议创建该复合索引，以支持高效的列表查询。

### `shop_config`（商铺配置）

| 索引名                     | 字段                  | 唯一 | 用途                           |
| -------------------------- | --------------------- | ---- | ------------------------------ |
| `idx_communityId`          | `communityId ASC`     | **是** | 每小区一条配置，upsert 定位    |

### `shop_registry`（商铺名册）

| 索引名                        | 字段                                                     | 唯一 | 用途                          |
| ----------------------------- | -------------------------------------------------------- | ---- | ----------------------------- |
| `idx_communityId`             | `communityId ASC`                                        | 否   | 按小区列表查询                |
| `idx_communityId_owner_shop`  | `communityId ASC, ownerName1 ASC, houseNumber ASC, shopName ASC` | 否 | 手动添加/导入去重             |

### `shop_certification_applications`（商铺认证申请）

| 索引名                         | 字段                                                 | 唯一 | 用途                                 |
| ------------------------------ | ---------------------------------------------------- | ---- | ------------------------------------ |
| `idx_communityId_status`       | `communityId ASC, status ASC`                        | 否   | 认证审核列表                         |
| `idx_openid_communityId_status` | `openid ASC, communityId ASC, status ASC`           | 否   | 小程序重复申请校验                   |
| `idx_communityId_shop`         | `communityId ASC, houseNumber ASC, shopName ASC`     | 否   | 商铺占用校验 / 名册状态匹配          |

### `shop_owner_list`（商铺户主名单）

| 索引名                       | 字段                                                      | 唯一 | 用途                           |
| ---------------------------- | --------------------------------------------------------- | ---- | ------------------------------ |
| `idx_communityId`            | `communityId ASC`                                         | 否   | 按小区列表查询                 |
| `idx_communityId_owner_shop` | `communityId ASC, name ASC, houseNumber ASC, shopName ASC` | 否 | 审核通过同步去重               |
| `idx_openid`                 | `openid ASC`                                              | 否   | 按 openid 查商铺户主           |
