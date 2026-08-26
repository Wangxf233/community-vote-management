// scripts/stress/cleanup-data.js — 清理全部压测数据并复查零残留
const fs = require("fs");
const path = require("path");
const { getTcb, loadStressData } = require("./lib");

async function main() {
  const dataPath = path.join(__dirname, "stress-data.json");
  if (!fs.existsSync(dataPath)) {
    console.log("无 stress-data.json，无需清理");
    return;
  }
  const data = loadStressData();
  const tcb = getTcb();
  const db = tcb.database();

  console.log("开始清理压测数据:", data.communityId);

  await db.collection("vote_records").where({ voteId: data.voteId }).remove();
  await db.collection("votes").doc(data.voteId).remove();
  await db
    .collection("owner_list")
    .where({ communityId: data.communityId })
    .remove();
  await db.collection("door_devices").doc(data.doorId).remove();
  await db
    .collection("door_open_logs")
    .where({ communityId: data.communityId })
    .remove();
  await db
    .collection("parking_violations")
    .where({ communityId: data.communityId })
    .remove();

  // 复查零残留
  const checks = [
    ["votes", "votes", { _id: data.voteId }],
    ["vote_records", "vote_records", { voteId: data.voteId }],
    ["owner_list", "owner_list", { communityId: data.communityId }],
    ["door_devices", "door_devices", { _id: data.doorId }],
    ["door_open_logs", "door_open_logs", { communityId: data.communityId }],
    ["parking_violations", "parking_violations", { communityId: data.communityId }],
  ];
  let clean = true;
  for (const [name, coll, where] of checks) {
    const r = await db.collection(coll).where(where).count();
    console.log(`  ${name}: 剩余 ${r.total} 条`);
    if (r.total > 0) clean = false;
  }

  if (clean) {
    fs.unlinkSync(dataPath);
    console.log("清理完成，压测数据零残留，已删除 stress-data.json");
  } else {
    console.error("存在残留数据，请人工检查");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("清理失败:", e.message || e);
  process.exit(1);
});
