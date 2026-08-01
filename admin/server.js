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

// 全局限流：仅对 /api/ 路由生效
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "rate_limit_exceeded",
  },
});
app.use("/api", globalLimiter);

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

// CORS — 仅允许已知来源
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://cloud1-6ghienoi526fff51.tcloudbaseapp.com",
];
app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin) || !origin) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  }
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

// 全局错误处理（在所有路由之后注册）
const { errorHandler, notFoundHandler } = require("./middleware/error-handler");
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 3000);

const server = app.listen(PORT, () => {
  console.log(`Admin service listening on port ${PORT}`);
});

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
