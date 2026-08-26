// scripts/stress/cloudfn-read.js — 投票读链路云函数压测（真实云函数 + 生产 CloudBase）
// 通过 admin 凭据 tcb.callFunction 并发调用：listVotes / getVoteDetail / getVoteStatistics
// 200 并发 × 各 5 轮；结果写入 result-cloudfn-read.json
const fs = require("fs");
const path = require("path");
const { getTcb, loadStressData, runWorkers, reportStage } = require("./lib");

const data = loadStressData();
const tcb = getTcb();

async function oneCall(fnName, payload) {
  const start = Date.now();
  try {
    const res = await tcb.callFunction({ name: fnName, data: payload });
    const ms = Date.now() - start;
    const ok = !!(res && res.result && res.result.success);
    return {
      ok,
      ms,
      error: ok ? null : (res && res.result && res.result.error) || "call_failed",
    };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, error: e.message || e.code || "exception" };
  }
}

async function main() {
  const targets = [
    {
      label: "listVotes（投票列表）",
      fn: "listVotes",
      payload: { communityId: data.communityId },
    },
    {
      label: "getVoteDetail（投票详情）",
      fn: "getVoteDetail",
      payload: { voteId: data.voteId, communityId: data.communityId },
    },
    {
      label: "getVoteStatistics（投票统计聚合）",
      fn: "getVoteStatistics",
      payload: { voteId: data.voteId },
    },
  ];

  const results = [];
  for (const t of targets) {
    console.log(`\n########## ${t.label} ##########`);
    const { latencies, errors, elapsed } = await runWorkers(200, 200 * 5, () =>
      oneCall(t.fn, t.payload),
    );
    results.push(reportStage(t.label, 200, 200 * 5, elapsed, latencies, errors));
  }

  const out = path.join(__dirname, "result-cloudfn-read.json");
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log("\n云函数读链路压测完成，结果已写入", out);
}

main().catch((e) => {
  console.error("云函数读压测失败:", e.message || e);
  process.exit(1);
});
