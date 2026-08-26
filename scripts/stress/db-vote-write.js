// scripts/stress/db-vote-write.js — 投票写链路 DB 竞争压测
// updateVote 的用户 openid 来自微信上下文，admin 凭据无法模拟多用户提交，
// 本脚本直连复刻其 DB 写模式（vote_records 固定 _id 插入 + votes 双字段 inc），
// 度量同一投票文档上的写竞争。200 并发 × 1000 次；结果写入 result-db-vote-write.json
const fs = require("fs");
const path = require("path");
const { getTcb, loadStressData, runWorkers, reportStage } = require("./lib");

const data = loadStressData();
const tcb = getTcb();
const db = tcb.database();
const _ = db.command;

async function oneWrite(seq) {
  const start = Date.now();
  try {
    // 注意：@cloudbase/node-sdk 的 add/update 直接收文档对象，不带 { data } 包装
    await db.collection("vote_records").add({
      _id: `${data.voteId}_stress_w${seq}`,
      voteId: data.voteId,
      communityId: data.communityId,
      openid: `stress_writer_${seq}`,
      optionId: "option1",
      area: 100,
      createdAt: new Date(),
    });
    await db
      .collection("votes")
      .doc(data.voteId)
      .update({
        "optionCounts.option1": _.inc(1),
        totalVotes: _.inc(1),
        updatedAt: new Date(),
      });
    return { ok: true, ms: Date.now() - start };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, error: e.message || e.code || "db_error" };
  }
}

async function main() {
  const { latencies, errors, elapsed } = await runWorkers(200, 1000, oneWrite);
  const result = reportStage("投票写入（vote_records 插入 + votes inc）", 200, 1000, elapsed, latencies, errors);

  const out = path.join(__dirname, "result-db-vote-write.json");
  fs.writeFileSync(out, JSON.stringify([result], null, 2));
  console.log("\n投票写压测完成，结果已写入", out);
}

main().catch((e) => {
  console.error("投票写压测失败:", e.message || e);
  process.exit(1);
});
