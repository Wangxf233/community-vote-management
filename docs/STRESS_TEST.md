# 压测方案 — 社区物业服务系统

> 针对推广初期 5000 用户规模的轻量压测方案。脚本位于 `scripts/stress/`，使用说明见 `scripts/stress/README.md`。

## 一、背景与目标

- 5000 用户、工具服务类小程序，峰值并发估算 100–250（2–5% 同时在线）
- 并发集中点：**投票**（截止前提交爆发）与**门禁**（开门长链路）
- 目标：
  - 门禁链路 150 并发：p95 < 3s、错误率 < 1%
  - 投票读链路 200 并发：p95 < 2s
  - 投票写链路 200 并发：验证 votes 单文档 inc 竞争表现

## 二、接口清单

| 链路 | 接口 | 层 | 说明 |
|------|------|----|----|
| 门禁 | `POST /api/door/open-from-cloud` | admin | 每次开门 = door_devices 读 + 厂商 HTTP + door_open_logs 写；压测时厂商 mock |
| 门禁 | `openDoor` 云函数 | 云函数 | 三层串行（小程序→云函数→admin→厂商），瓶颈在 admin 与厂商 |
| 投票读 | `listVotes` / `getVoteDetail` / `getVoteStatistics` | 云函数 | getVoteDetail 无 limit 全量拉取 owner_list/vote_records（读放大风险） |
| 投票写 | `updateVote`（提交） | 云函数 | votes 单文档 optionCounts/totalVotes 的 inc 竞争 + vote_records 固定 _id 幂等插入 |

## 三、压测方式与限制

- **门禁**：本地 admin（`FONDCARD_MOCK_MODE=1 RATE_LIMIT_MAX=100000`）打 open-from-cloud，直连生产 CloudBase 库。限制：Express 跑本地机器，非云托管 0.25 核规格，报告注明差异
- **投票读**：admin 凭据 `tcb.callFunction` 打真实云函数（真实云函数并发/配额）
- **投票写**：updateVote 的 openid 来自微信上下文，admin 凭据无法模拟多用户提交 → 用 `db-vote-write.js` 直连复刻等价 DB 写模式
- **数据隔离**：全部压测数据在 `stress_community_<ts>` 小区内，测后 `cleanup-data.js` 清理并复查零残留
- **厂商接口**：压测一律 mock，不真实调用

## 四、已识别的生产风险（来自代码调研）

1. ~~admin 全局限流默认 100 次/分钟/IP 覆盖 open-from-cloud~~ **已修复**：open-from-cloud 跳过全局限流，改用单独门禁限流（默认 600 次/分钟/IP，`DOOR_RATE_LIMIT_MAX` 可调）
2. admin 云托管 0.25 核 / 0.5GB / max 3 副本 —— 门禁链路容量上限（配额提升后需在云托管复测）
3. ~~getVoteDetail / listVotes 无 limit 全量拉取~~ **已修复**：getVoteDetail 改为 4 条数据库侧聚合（不再全量拉取 owner_list / vote_records）；listVotes 加 limit(100)
4. ~~door_open_logs 写入~~ **已修复**：修正 node-sdk add 语法（原 `{data}` 包装导致全部日志为错误结构）+ 异步化不阻塞开门响应
5. ~~`trust proxy` 未配置~~ **已修复**：默认 `trust proxy=1`（云托管网关注入 X-Forwarded-For），可用 `TRUST_PROXY=0` 关闭
6. 云函数无 HTTP 触发器，k6 无法直打；fondcard-client 无连接复用（默认 agent）—— 遗留观察项

## 五、执行与报告

按 `scripts/stress/README.md` 执行，指标填入 `scripts/stress/report-template.md`，产出结论。小程序前端性能测试见 `scripts/stress/miniprogram-performance.md`。
