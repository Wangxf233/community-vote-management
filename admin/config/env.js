/**
 * Express 后端环境变量校验
 *
 * 在 server.js 最顶部引入：
 *   require("./config/env");  // 校验通过才继续
 */

const required = ["TCB_ENV_ID", "TCB_SECRET_ID", "TCB_SECRET_KEY"];

const optional = {
  PORT: { default: "3000" },
  DOOR_CLOUD_ACCESS_KEY: { default: "" },
  FONDCARD_API_BASE_URL: { default: "" },
  FONDCARD_API_TIMEOUT_MS: { default: "12000" },
  FONDCARD_OPEN_METHOD: { default: "" },
  FONDCARD_OPEN_PLATFORM: { default: "" },
  FONDCARD_OPEN_LOGIN_ID: { default: "" },
  // 厂商固定参数（全局默认值，优先读构造函数参数 > 此处环境变量 > 代码默认值）
  FONDCARD_DEFAULT_PLATFORM: { default: "antai" },
  FONDCARD_DEFAULT_LOGIN_ID: { default: "11609" },
  LOG_LEVEL: { default: "info" },
};

let hasError = false;

required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`[ENV] FATAL: 缺少必需的环境变量 ${key}`);
    console.error(`  请检查 admin/.env 文件是否配置完整，参考 admin/.env.example`);
    hasError = true;
  }
});

// 设置可选的默认值
Object.entries(optional).forEach(([key, config]) => {
  if (!process.env[key]) {
    process.env[key] = config.default;
  }
});

if (hasError) {
  console.error("[ENV] 缺少必需环境变量，进程退出");
  process.exit(1);
}

console.log("[ENV] 环境变量校验通过");
