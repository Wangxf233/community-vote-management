# 压测实测报告（2026-08-23）

> 执行方式：本地 mock admin（端口 3001，`FONDCARD_MOCK_MODE=1 RATE_LIMIT_MAX=100000`）+ 生产 CloudBase 库（隔离压测数据，已清理零残留）。脚本位于 `scripts/stress/`。

## 一、压测环境

| 项 | 值 |
|----|----|
| CloudBase 环境 | `cloud1-6ghienoi526fff51`（生产库 + 隔离压测数据） |
| admin 部署形态 | 本地 Node v22（开发机）+ 生产 CloudBase 库；云托管为 0.25 核/0.5G/max3 副本 |
| 厂商接口 | mock（FONDCARD_MOCK_MODE=1，冒烟确认返回 mock_success） |
| 压测数据 | 压测小区 1 个、户主 200、投票 1、门禁设备 1；测后清理复查全部 0 残留 |

## 二、门禁链路（POST /api/door/open-from-cloud）

| 阶段 | 并发 | 总请求 | 耗时(s) | RPS | 成功率 | p50 | p95 | p99 | max | 主要错误 |
|------|------|--------|---------|-----|--------|-----|-----|-----|-----|----------|
| 试跑 | 10 | 100 | 1.4 | 71.1 | 100% | 119ms | 280ms | 290ms | 290ms | 无 |
| 中压 | 50 | 500 | 4.1 | 122.4 | 100% | 367ms | 626ms | 759ms | 1176ms | 无 |
| 目标 | 150 | 1500 | 5.7 | 262.2 | 98.5% | 477ms | 1274ms | 1682ms | 1960ms | CloudBase 环境级 DB 限流 22 次（1.47%） |

**结论**：应用层（Express + mock 厂商）150 并发下吞吐 262 RPS、p95 1.27s，无超时堆积、无 429。失败全部来自 **CloudBase 数据库环境级限流**（door_open_logs 每次开门 1 条写入，260+ 写/s 触顶）。门禁链路按 5000 用户规模（峰值百级并发）**应用层无瓶颈**，但 DB 写入配额是天花板。

## 三、投票读链路（云函数，200 并发 × 5 轮 = 1000 请求）

| 云函数 | RPS | 成功率 | p50 | p95 | p99 | 主要错误 |
|--------|-----|--------|-----|-----|-----|----------|
| listVotes | 171.4 | **50.5%** | 222ms | 2034ms | 2082ms | env ratelimit 458 次 |
| getVoteDetail | 200.8 | **23.2%** | 183ms | 2194ms | 2255ms | env ratelimit 737 次 |
| getVoteStatistics | 231.7 | **23.6%** | 178ms | 1956ms | 2027ms | env ratelimit（collection.get/aggregate/document.get）764 次 |

**结论**：**200 并发下投票读链路 50–77% 失败，全部是 CloudBase 环境级数据库 QPS 限流**（EXCEED_RATELIMIT / -501001）。getVoteDetail 内部 4 次 DB 查询（含全量 owner_list/vote_records 拉取），单个请求 DB 放大严重，最先触顶。**这是当前最需要解决的问题**。

## 四、投票写链路（DB 等价模式，200 并发 × 1000 次）

| 指标 | 值 |
|------|----|
| 耗时(s) / RPS | 2.2s / 452.9 |
| 成功率 | **50.4%**（失败 496 次） |
| p50 / p95 / p99 | 420ms / 789ms / 823ms |
| 主要错误 | 全部为 env ratelimit |

**结论**：votes 单文档 inc + vote_records 插入本身**没有出现写冲突/幂等错误**（固定 _id 机制稳定），p95 789ms 可接受；瓶颈同样是**环境级 DB 写限流**（约 450 写/s 时失败率 50%）。

## 五、总体结论与建议

1. **最紧急（P0）——CloudBase 数据库 QPS 配额**：当前环境在 ~170–230 读 RPS / ~450 写 RPS 即触发环境级限流。投票发布/截止时的 200 人并发场景下，投票列表/详情/提交会大面积失败。**建议在云开发控制台升级数据库 QPS 配额（或升级套餐）**，目标至少支撑 1000 读 QPS + 500 写 QPS，再复测一次确认。
2. **门禁链路（P1）**：应用层无瓶颈（150 并发 p95 1.27s、无 429），主要受 DB 写限流影响（door_open_logs 每次开门必写）。可考虑：开门日志改批量/异步写入，或限流触发时降级不写日志。
3. **生产默认限流风险（P1）**：admin 全局 100 次/分钟/IP 覆盖 open-from-cloud —— 生产同出口 IP 每分钟开门超 100 次即 429，且云托管下未设 `trust proxy`，可能按网关 IP 计数。建议：门禁路径单独调高或按 x-cloud-access-key 排除，并配置 trust proxy。
4. **读放大（P2）**：getVoteDetail 每次全量拉取小区 owner_list 与该投票 vote_records（无 limit），小区户主数增长后单请求 DB 读放大显著（本次压测中 getVoteDetail 失败率最高）。建议加分页 limit 或缓存。
5. **云托管容量（P2）**：0.25 核/0.5G/max3 副本 —— 本次本地压测未触及该上限；若 DB 配额提升后需复测真实云托管实例。
6. **小程序前端性能**：见 `scripts/stress/miniprogram-performance.md` 手册，需开发者工具/真机配合执行。

## 六、测试数据清理确认

cleanup-data.js 复查：votes / vote_records / owner_list / door_devices / door_open_logs / parking_violations **全部 0 残留** ✔；mock admin 已停止。

## 七、压测后已实施的修复（2026-08-23）

1. **door_open_logs 写入 bug（生产级）**：压测发现全部开门日志以 `{data:...}` 包装结构存库（node-sdk add 语法错误，任何按顶层字段的查询都读不到）。已修复为直接文档结构 + 异步写入（不阻塞开门响应），并清理了压测产生的 2024 条包装残留。
2. **admin 限流分层**：open-from-cloud 跳过全局 100 次/分钟限流，改用单独门禁限流（默认 600 次/分钟/IP，`DOOR_RATE_LIMIT_MAX`/`DOOR_RATE_LIMIT_WINDOW_MS` 可调）；`trust proxy` 默认开启（`TRUST_PROXY=0` 可关），避免云托管下按网关 IP 合并计数。
3. **getVoteDetail 读放大**：删除 owner_list / vote_records 两次无 limit 全量拉取，改为 4 条数据库侧聚合（总户主数、总面积、参与人数、参与面积），单请求 DB 传输量从 ~10MB 级降到常数级；listVotes 加 limit(100)。
4. 环境变量全部记入 `admin/.env.example`（RATE_LIMIT_* / DOOR_RATE_LIMIT_* / TRUST_PROXY / FONDCARD_MOCK_MODE）。

**复测建议**：数据库 QPS 配额提升后，重跑 `scripts/stress/`（尤其 cloudfn-read.js）验证 getVoteDetail 失败率明显下降；mock 代码部署云托管后对生产 URL 重跑 door-load.js。

## 附：遗留说明

- admin 单测 `__tests__/middleware/error-handler.test.js` 有 1 个失败（AppError 404 断言收到 500），为本次改动前已存在的问题，与压测无关，建议后续修复。
- 压测期间修复了压测脚本自身的 node-sdk `add/update` 语法（不带 `{ data }` 包装），并清理了误写的 202 条包装文档。
