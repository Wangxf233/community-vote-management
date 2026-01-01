const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const { tcb, db } = require("./config/db");
const authRoutes = require("./routes/auth");

const app = express();
app.use(bodyParser.json());

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 限制10MB
});

// CORS配置
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// 挂载认证路由
app.use("/api", authRoutes);

// TODO: 挂载其他路由模块
// const ownerRoutes = require("./routes/owner");
// const communityRoutes = require("./routes/community");
// const certificationRoutes = require("./routes/certification");
// const voteRoutes = require("./routes/vote");
// app.use("/api", ownerRoutes);
// app.use("/api", communityRoutes);
// app.use("/api", certificationRoutes);
// app.use("/api", voteRoutes);

// 临时：加载原有的所有路由（从 server.old.js）
// 在完成迁移前，保持原有功能正常运行
const serverOld = require("./server.old");
serverOld.setupRoutes(app, tcb, db, upload);

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Admin server running on http://localhost:${PORT}`);
});

module.exports = app;
