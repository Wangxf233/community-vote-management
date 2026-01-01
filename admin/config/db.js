const cloudbase = require("@cloudbase/node-sdk");
require("dotenv").config();

const ENV_ID = process.env.TCB_ENV_ID;
const SECRET_ID = process.env.TCB_SECRET_ID;
const SECRET_KEY = process.env.TCB_SECRET_KEY;

if (!ENV_ID || !SECRET_ID || !SECRET_KEY) {
  console.warn("Warning: TCB env vars not set. See admin/.env.example");
}

const tcb = cloudbase.init({
  env: ENV_ID,
  secretId: SECRET_ID,
  secretKey: SECRET_KEY,
});

const db = tcb.database();

module.exports = { tcb, db };
