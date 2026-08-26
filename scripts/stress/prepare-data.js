// scripts/stress/prepare-data.js — 创建压测数据（生产库中的隔离测试数据，带 stress 前缀）
// 产物：scripts/stress/stress-data.json（压测参数清单，供各脚本与清理脚本使用）
const fs = require("fs");
const path = require("path");
const { getTcb } = require("./lib");

async function main() {
  const tcb = getTcb();
  const db = tcb.database();

  const TS = Date.now();
  const N_OWNERS = 200;
  const data = {
    ts: TS,
    communityId: `stress_community_${TS}`,
    voteId: `stress_vote_${TS}`,
    doorId: `stress_door_${TS}`,
    serial: "STRESS000001",
    ownerOpenid: "stress_user_openid",
    ownerCount: N_OWNERS,
  };
  console.log("压测参数:", data);

  // 1. 压测户主（200 个，openid=stress_user_1..200，供 getVoteStatistics 聚合与写压测用）
  //    注意：@cloudbase/node-sdk 的 add 直接收文档对象，不带 { data } 包装
  for (let i = 1; i <= N_OWNERS; i++) {
    await db.collection("owner_list").add({
      communityId: data.communityId,
      name: "压测户主",
      phone: "13800000000",
      openid: `stress_user_${i}`,
      building: "1",
      unit: "1",
      room: String(i),
      area: 100,
      deleted: false,
      createdAt: new Date(),
    });
    if (i % 50 === 0) console.log(`  已创建户主 ${i}/${N_OWNERS}`);
  }

  // 2. 压测投票
  await db.collection("votes").add({
    _id: data.voteId,
    communityId: data.communityId,
    type: "vote",
    title: `压测投票${TS}`,
    detail: "压测专用投票，测后自动清理",
    initiator: "业委会",
    publishTime: new Date(),
    deadlineTime: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    status: "active",
    optionMode: "fixed",
    options: [
      { id: "option1", text: "同意" },
      { id: "option2", text: "不同意" },
      { id: "option3", text: "弃权" },
    ],
    optionCounts: {},
    totalVotes: 0,
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 3. 门禁设备（all_owners + 白名单已含压测 openid → 每次请求走稳态开门路径：
  //    door_devices 读 → 厂商 mock → door_open_logs 写，不触发自动注册分支）
  await db.collection("door_devices").add({
    _id: data.doorId,
    communityId: data.communityId,
    serial: data.serial,
    name: "压测门禁",
    enabled: true,
    permissionMode: "all_owners",
    locationType: "community_gate",
    grantedOwnerOpenids: [data.ownerOpenid],
    password: "stresspass",
    platform: "antai",
    loginId: "11609",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const outPath = path.join(__dirname, "stress-data.json");
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log("压测数据准备完成，已写入", outPath);
}

main().catch((e) => {
  console.error("压测数据准备失败:", e.message || e);
  process.exit(1);
});
