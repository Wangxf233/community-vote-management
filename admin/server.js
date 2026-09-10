const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// 环境变量校验（缺少必需变量时进程拒绝启动）
require("./config/env");

const authRoutes = require("./routes/auth");
const ownerRoutes = require("./routes/owner");
const bindingRoutes = require("./routes/binding");
const communityRoutes = require("./routes/community");
const voteRoutes = require("./routes/vote");
const userRoutes = require("./routes/user");
const houseRoutes = require("./routes/house");
const uploadRoutes = require("./routes/upload");
const exportRoutes = require("./routes/export");
const certificationRoutes = require("./routes/certification");
const repairRoutes = require("./routes/repair");
const reportRoutes = require("./routes/report");
const evaluationRoutes = require("./routes/evaluation");
const announcementRoutes = require("./routes/announcement");
const communityInfoRoutes = require("./routes/communityInfo");
const regionRoutes = require("./routes/region");
const doorRoutes = require("./routes/door");
const fondcardRoutes = require("./routes/fondcard");
const vehicleRoutes = require("./routes/vehicle");
const staffRoutes = require("./routes/staff");
const shopRoutes = require("./routes/shop");

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  console.error(err.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

const app = express();

// === 安全中间件 ===

// 安全响应头 — 关闭与 CORS 开发环境冲突的选项
app.use(helmet({
  crossOriginResourcePolicy: false,   // 开发时前后端不同端口，不能 same-origin
  crossOriginOpenerPolicy: false,     // 同上
}));

// 云托管网关会注入 X-Forwarded-For；不配置 trust proxy 时 express-rate-limit 会把
// 所有请求按网关 IP 合并计数（每个小区共享一个额度）。默认开启 trust proxy=1，
// 本地无代理时自动回退为 socket 地址；可用 TRUST_PROXY=0 关闭。
app.set("trust proxy", process.env.TRUST_PROXY === "0" ? false : 1);

// 全局限流：仅对 /api/ 路由生效（压测时可用 RATE_LIMIT_MAX/RATE_LIMIT_WINDOW_MS 临时调大）
// 门禁 open-from-cloud 由单独的 doorOpenLimiter 控制（见下），不占全局额度
const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 100),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const path = req.path || "";
    return path.endsWith("/door/open-from-cloud");
  },
  message: {
    success: false,
    error: "rate_limit_exceeded",
  },
});
app.use("/api", globalLimiter);

// 门禁开门接口单独限流：每次开门是一次真实开锁+厂商请求，默认 600 次/分钟/IP，
// 可用 DOOR_RATE_LIMIT_MAX / DOOR_RATE_LIMIT_WINDOW_MS 调整
const doorOpenLimiter = rateLimit({
  windowMs: Number(process.env.DOOR_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(process.env.DOOR_RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "door_rate_limit_exceeded",
  },
});
app.use("/api/door/open-from-cloud", doorOpenLimiter);

// 登录接口严格限流：每个 IP 每分钟最多 10 次
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "rate_limit_exceeded",
  },
});
app.use("/api/login", loginLimiter);

app.use(bodyParser.json());

// CORS — 允许所有来源（CloudBase 上域名多，统一放行）
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use("/api", authRoutes);
app.use("/api", ownerRoutes);
app.use("/api", bindingRoutes);
app.use("/api", communityRoutes);
app.use("/api", voteRoutes);
app.use("/api", userRoutes);
app.use("/api", houseRoutes);
app.use("/api", uploadRoutes);
app.use("/api", exportRoutes);
app.use("/api", certificationRoutes);
app.use("/api/repairs", repairRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/evaluation", evaluationRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/notifications", announcementRoutes);
app.use("/api/community-info", communityInfoRoutes);
app.use("/api", regionRoutes);
app.use("/api", doorRoutes);
app.use("/api", fondcardRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api", shopRoutes);

// 全局错误处理（在所有路由之后注册）
const { errorHandler, notFoundHandler } = require("./middleware/error-handler");
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 3000);

const server = app.listen(PORT, () => {
  console.log(`Admin service listening on port ${PORT}`);

  // 定期检查自动发布评价（每小时一次）
  checkRecurringEvaluations();
  setInterval(checkRecurringEvaluations, 60 * 60 * 1000);
});

function addInterval(date, frequency) {
  const d = new Date(date);
  switch (frequency) {
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "semi_annual": d.setMonth(d.getMonth() + 6); break;
    case "annual": d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 3);
  }
  return d;
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 计算该日期所在自然周期的天数（自然月/自然季度/自然半年/自然年）
function naturalPeriodDays(date, frequency) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const y = date.getFullYear();
  const m = date.getMonth();
  let start;
  let next;
  if (frequency === "monthly") {
    start = new Date(y, m, 1);
    next = new Date(y, m + 1, 1);
  } else if (frequency === "quarterly") {
    start = new Date(y, Math.floor(m / 3) * 3, 1);
    next = new Date(start.getFullYear(), start.getMonth() + 3, 1);
  } else if (frequency === "semi_annual") {
    start = new Date(y, Math.floor(m / 6) * 6, 1);
    next = new Date(start.getFullYear(), start.getMonth() + 6, 1);
  } else if (frequency === "annual") {
    start = new Date(y, 0, 1);
    next = new Date(y + 1, 0, 1);
  } else {
    return 90;
  }
  return Math.round((next.getTime() - start.getTime()) / msPerDay);
}

// 自动发布检查
async function checkRecurringEvaluations() {
  try {
    const now = new Date();
    const { db } = require("./config/db");
    const closedCycles = await db
      .collection("evaluation_cycles")
      .where({ "recurring.enabled": true, status: "closed" })
      .limit(100)
      .get();

    let generated = 0;
    const cycles = closedCycles.data || [];

    for (const cycle of cycles) {
      const rec = cycle.recurring;
      if (!rec || !rec.enabled) continue;

      const baseDate = rec.lastGeneratedDate
        ? new Date(rec.lastGeneratedDate)
        : new Date(cycle.startDate);
      const nextStart = addInterval(baseDate, rec.frequency);

      if (rec.totalEndDate && nextStart > new Date(rec.totalEndDate)) continue;

      if (nextStart > now) continue;

      // 按该期所在自然周期的实际天数计算（每月=自然月，每季度=自然季度，每半年=自然半年，每年=自然年）
      const cycleDurationDays = naturalPeriodDays(nextStart, rec.frequency);
      const nextEnd = new Date(nextStart);
      nextEnd.setDate(nextEnd.getDate() + cycleDurationDays - 1);

      const newCycle = {
        title: cycle.title,
        startDate: fmtDate(nextStart),
        endDate: fmtDate(nextEnd),
        startSubmitTime: nextStart.toISOString(),
        deadline: nextEnd.toISOString(),
        staffIds: cycle.staffIds || [],
        dimensions: cycle.dimensions || [],
        status: nextStart <= now && now < nextEnd ? "ongoing" : "draft",
        type: cycle.type || "staff",
        communityId: cycle.communityId,
        recurring: {
          enabled: true,
          frequency: rec.frequency,
          firstDate: rec.firstDate,
          totalEndDate: rec.totalEndDate || null,
          lastGeneratedDate: null,
        },
        createdAt: now,
        updatedAt: now,
      };

      await db.collection("evaluation_cycles").add(newCycle);

      await db
        .collection("evaluation_cycles")
        .doc(cycle._id)
        .update({
          "recurring.lastGeneratedDate": fmtDate(nextStart),
          updatedAt: now,
        });

      generated++;
    }

    if (generated > 0) {
      console.log(`[自动发布] 已生成 ${generated} 期新评价`);
    }
  } catch (err) {
    console.error("[自动发布] 检查失败:", err.message);
  }
}

server.on("error", (err) => {
  console.error("Server error:", err);
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

function shutdown(signal) {
  console.log(`${signal} received, closing server...`);
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
