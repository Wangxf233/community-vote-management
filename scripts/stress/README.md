# 压测脚本使用说明（scripts/stress/）

针对 5000 用户规模的轻量压测套件。全部 Node 原生实现，无新增依赖（复用 admin 的 @cloudbase/node-sdk）。

## 前置条件

1. 本地存在 `admin/.env`（含 TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY / DOOR_CLOUD_ACCESS_KEY）
2. 云函数已部署：`listVotes` / `getVoteDetail` / `getVoteStatistics`
3. Node ≥ 18

## 执行顺序

```bash
cd scripts/stress

# 1. 启动本地 admin（mock 厂商 + 调大限流）
cd ../../admin
FONDCARD_MOCK_MODE=1 RATE_LIMIT_MAX=100000 node server.js

# 2. 准备压测数据（生产库中的隔离测试数据，带 stress 前缀）
node scripts/stress/prepare-data.js

# 3. mock 冒烟：确认一次开门走 mock 分支
#    （观察 admin 控制台无 fondcard 真实请求日志，返回 success）

# 4. 门禁链路压测（10 → 50 → 150 并发）
node scripts/stress/door-load.js

# 5. 投票读链路云函数压测（200 并发）
node scripts/stress/cloudfn-read.js

# 6. 投票写链路 DB 竞争压测（200 并发）
node scripts/stress/db-vote-write.js

# 7. 清理压测数据（自动复查零残留）
node scripts/stress/cleanup-data.js

# 8. 停止 admin，恢复无 mock 的正常启动
```

## 结果文件

| 文件 | 内容 |
|------|------|
| `result-door.json` | 门禁各阶段：RPS / 成功率 / p50-p95-p99 / 错误分布（429、超时等） |
| `result-cloudfn-read.json` | 三个投票读云函数各 200 并发 × 5 轮指标 |
| `result-db-vote-write.json` | votes 单文档 inc + vote_records 插入的写竞争指标 |
| `report-template.md` | 报告模板（填入三个结果文件数据） |

## 注意事项

- **门禁压测必须 mock 厂商**（`FONDCARD_MOCK_MODE=1`），否则会真实开门 + 厂商限流
- 压测数据全部在 `stress_community_<ts>` 小区内，`cleanup-data.js` 会清理并复查零残留
- 本地 admin 与云托管规格（0.25 核）不同，报告需注明该差异
- 压测期间可在云开发控制台观察：云函数并发实例数、限流错误（-501005 类）
