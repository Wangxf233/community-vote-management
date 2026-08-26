// scripts/stress/lib.js — 压测脚本共享工具
const fs = require("fs");
const path = require("path");

// 从 admin/.env 加载环境变量（不覆盖已存在的变量）
function loadAdminEnv() {
  const envPath = path.join(__dirname, "..", "..", "admin", ".env");
  if (!fs.existsSync(envPath)) {
    console.warn(`未找到 ${envPath}`);
    return;
  }
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// 从 admin/node_modules 加载 @cloudbase/node-sdk（脚本不在 admin 包内，需绝对路径回退）
function getTcb() {
  loadAdminEnv();
  let cloudbase;
  try {
    cloudbase = require("@cloudbase/node-sdk");
  } catch (e) {
    cloudbase = require(
      path.join(__dirname, "..", "..", "admin", "node_modules", "@cloudbase", "node-sdk"),
    );
  }
  if (!process.env.TCB_ENV_ID || !process.env.TCB_SECRET_ID || !process.env.TCB_SECRET_KEY) {
    throw new Error("缺少 TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY（检查 admin/.env）");
  }
  return cloudbase.init({
    env: process.env.TCB_ENV_ID,
    secretId: process.env.TCB_SECRET_ID,
    secretKey: process.env.TCB_SECRET_KEY,
  });
}

function loadStressData() {
  const p = path.join(__dirname, "stress-data.json");
  if (!fs.existsSync(p)) {
    throw new Error("未找到 stress-data.json，请先运行 node prepare-data.js");
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// 计算百分位延迟
function latencyStats(latencies, errors) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const p = (q) =>
    sorted.length
      ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
      : 0;
  return {
    count: latencies.length,
    errors: errors.length,
    min: sorted[0] || 0,
    p50: p(0.5),
    p95: p(0.95),
    p99: p(0.99),
    max: sorted[sorted.length - 1] || 0,
  };
}

// 通用并发压测执行器：workers 并发取号执行 oneTask(idx)
async function runWorkers(vus, total, oneTask) {
  const latencies = [];
  const errors = [];
  let next = 0;
  const t0 = Date.now();
  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= total) break;
      const r = await oneTask(idx);
      latencies.push(r.ms);
      if (!r.ok) errors.push(r);
    }
  }
  await Promise.all(Array.from({ length: vus }, worker));
  const elapsed = (Date.now() - t0) / 1000;
  return { latencies, errors, elapsed };
}

// 输出一轮结果并汇总错误分布
function reportStage(label, vus, total, elapsed, latencies, errors) {
  const s = latencyStats(latencies, errors);
  const rps = elapsed > 0 ? (s.count / elapsed).toFixed(1) : "0";
  console.log(`\n=== ${label}：${vus} 并发 × ${total} 请求 ===`);
  console.log(`耗时 ${elapsed.toFixed(1)}s，RPS=${rps}`);
  console.log(
    `成功 ${s.count - s.errors}/${s.count}，失败 ${s.errors}（${((s.errors / Math.max(s.count, 1)) * 100).toFixed(2)}%）`,
  );
  console.log(
    `延迟(ms): min=${s.min} p50=${s.p50} p95=${s.p95} p99=${s.p99} max=${s.max}`,
  );
  const errSummary = {};
  errors.forEach((e) => {
    const k = e.error || `HTTP_${e.status || "unknown"}`;
    errSummary[k] = (errSummary[k] || 0) + 1;
  });
  if (Object.keys(errSummary).length > 0) {
    console.log("错误分布:", JSON.stringify(errSummary));
  }
  return { label, vus, total, elapsed: Number(elapsed.toFixed(1)), rps, ...s, errSummary };
}

module.exports = { loadAdminEnv, getTcb, loadStressData, runWorkers, reportStage };
