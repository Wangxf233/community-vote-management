// scripts/stress/door-load.js — 门禁链路压测
// 打本地 admin 的 POST /api/door/open-from-cloud（需以 FONDCARD_MOCK_MODE=1 启动 admin）
// 阶梯：10 → 50 → 150 并发；结果写入 result-door.json
const fs = require("fs");
const path = require("path");
const { loadAdminEnv, loadStressData, runWorkers, reportStage } = require("./lib");

loadAdminEnv();
const ACCESS_KEY = process.env.DOOR_CLOUD_ACCESS_KEY;
const BASE_URL = process.env.STRESS_ADMIN_URL || "http://localhost:3000";
const data = loadStressData();

if (!ACCESS_KEY) {
  console.error("缺少 DOOR_CLOUD_ACCESS_KEY（检查 admin/.env）");
  process.exit(1);
}

async function oneOpen() {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/door/open-from-cloud`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cloud-access-key": ACCESS_KEY,
      },
      body: JSON.stringify({
        openid: data.ownerOpenid,
        serial: data.serial,
        communityId: data.communityId,
        requestId: `stress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),
    });
    const ms = Date.now() - start;
    const body = await res.json().catch(() => ({}));
    if (res.status === 200 && body.success) {
      return { ok: true, ms };
    }
    return { ok: false, ms, status: res.status, error: body.error || `HTTP_${res.status}` };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, error: e.message || "network_error" };
  }
}

async function main() {
  const stages = [
    { label: "试跑", vus: 10, total: 100 },
    { label: "中压", vus: 50, total: 500 },
    { label: "目标", vus: 150, total: 1500 },
  ];
  const results = [];
  for (const st of stages) {
    const { latencies, errors, elapsed } = await runWorkers(st.vus, st.total, oneOpen);
    results.push(reportStage(st.label, st.vus, st.total, elapsed, latencies, errors));
  }
  const out = path.join(__dirname, "result-door.json");
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log("\n门禁压测完成，结果已写入", out);
}

main().catch((e) => {
  console.error("门禁压测失败:", e.message || e);
  process.exit(1);
});
