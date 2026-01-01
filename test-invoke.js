// test-invoke.js
const cloudbase = require("@cloudbase/node-sdk");

const ENV_ID = "cloud1-6ghienoi526fff51"; // 确认为你的 env
const SECRET_ID = process.env.TCB_SECRET_ID || "你的SecretId";
const SECRET_KEY = process.env.TCB_SECRET_KEY || "你的SecretKey";

console.log("Using env:", ENV_ID);
console.log("Using secret id prefix:", SECRET_ID && SECRET_ID.slice(0, 8));

const app = cloudbase.init({
  env: ENV_ID,
  secretId: SECRET_ID,
  secretKey: SECRET_KEY,
});

(async () => {
  try {
    console.log("Calling function initData ...");
    const r = await app.callFunction({ name: "initData", data: {} });
    console.log("CALL OK:", JSON.stringify(r, null, 2));
  } catch (err) {
    console.error("CALL ERROR:");
    // 打印完整错误对象，包含 code/message/stack
    console.error(err && err.stack ? err.stack : err);
    // 如果有 err.code / err.message 也打印
    console.error("err.code=", err && err.code);
    console.error("err.message=", err && err.message);
    console.error(
      "full err:",
      JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
    );
  }
})();
