const express = require("express");
const bodyParser = require("body-parser");
const cloudbase = require("@cloudbase/node-sdk");
require("dotenv").config();

// 全局错误处理 - 防止未捕获的异常导致进程崩溃
process.on("uncaughtException", (err) => {
  console.error("❌ 未捕获的异常:", err);
  console.error("堆栈信息:", err.stack);
  // 不退出进程，继续运行
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ 未处理的 Promise rejection:", reason);
  console.error("Promise:", promise);
  // 不退出进程，继续运行
});

// 引入模块化路由
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

const app = express();
app.use(bodyParser.json());

// Enable simple CORS for local development so the frontend (vite dev server)
// can call the admin API directly during development. This is intentionally
// permissive and should be tightened or removed in production.
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

// 健康检查接口（用于云托管健康检查）
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 挂载模块化路由
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
app.use("/api/notifications", announcementRoutes); // 通知公告使用相同的路由
app.use("/api/community-info", communityInfoRoutes);

// Helper to extract Bearer token or query token (保留用于未迁移的路由)
function getTokenFromReq(req) {
  try {
    const h = req.header ? req.header("authorization") : null;
    if (h && typeof h === "string" && h.toLowerCase().startsWith("bearer ")) {
      return h.replace(/^[Bb]earer\s+/, "");
    }
    return (req.query && (req.query.adminToken || req.query.token)) || null;
  } catch (_) {
    return null;
  }
}

const ENV_ID = process.env.TCB_ENV_ID;
const SECRET_ID = process.env.TCB_SECRET_ID;
const SECRET_KEY = process.env.TCB_SECRET_KEY;

if (!ENV_ID || !SECRET_ID || !SECRET_KEY) {
  console.warn("⚠️  Warning: TCB env vars not set. See admin/.env.example");
}

const tcb = cloudbase.init({
  env: ENV_ID,
  secretId: SECRET_ID,
  secretKey: SECRET_KEY,
  timeout: 15000, // 设置超时时间为 15 秒
});

const db = tcb.database();

// 测试数据库连接
async function testDatabaseConnection() {
  try {
    console.log("🔍 正在测试数据库连接...");
    await db.collection("users").limit(1).get();
    console.log("✅ 数据库连接成功");
    return true;
  } catch (error) {
    console.error("❌ 数据库连接失败:", error.message);
    console.error("请检查:");
    console.error("  1. 腾讯云开发环境 ID 是否正确");
    console.error("  2. Secret ID 和 Secret Key 是否有效");
    console.error("  3. 网络连接是否正常");
    return false;
  }
}

// 延迟测试数据库连接（避免阻塞服务启动）
setTimeout(() => {
  testDatabaseConnection();
}, 2000);

async function ensureAdmin(token) {
  if (!token) {
    return null;
  }
  const res = await db.collection("users").where({ token }).limit(1).get();
  if (res && res.data && res.data.length > 0) {
    const u = res.data[0];
    if (u.role === "super" || u.role === "community" || u.role === "admin")
      return u;
  }
  return null;
}

// ===== 以下登录路由已迁移到 routes/auth.js，保留注释作为参考 =====
/*
// login via phone + sms code
app.post("/api/login/sms", async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (!phone || !code)
      return res.status(400).json({ success: false, error: "missing_params" });
    // lookup latest code for this phone
    const list = await db
      .collection("sms_codes")
      .where({ phone })
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();
    if (!list || !list.data || list.data.length === 0)
      return res.status(401).json({ success: false, error: "invalid_code" });
    const match = list.data.find(
      (item) => item.code === code && new Date(item.expiresAt) > new Date()
    );
    if (!match)
      return res.status(401).json({ success: false, error: "invalid_code" });
    // find user by phone
    const ures = await db.collection("users").where({ phone }).limit(1).get();
    if (!ures || !ures.data || ures.data.length === 0)
      return res.status(401).json({ success: false, error: "user_not_found" });
    const user = ures.data[0];
    if (
      !(
        user.role === "super" ||
        user.role === "community" ||
        user.role === "admin"
      )
    )
      return res.status(403).json({ success: false, error: "forbidden" });
    // create/update token so frontend can call protected endpoints
    try {
      const token = require("crypto").randomBytes(16).toString("hex");
      // 写入顶层 token 字段，避免产生 data 子文档
      await db.collection("users").doc(user._id).update({
        token,
        updatedAt: new Date(),
      });
      return res.json({
        success: true,
        token,
        user: { _id: user._id, username: user.username, role: user.role },
      });
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, error: err.message || err });
    }
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});
*/

// login via username + password
/*
app.post("/api/login/password", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: "missing_params" });
    }
    // find user by username
    const ures = await db
      .collection("users")
      .where({ username })
      .limit(1)
      .get();
    if (!ures || !ures.data || ures.data.length === 0) {
      return res
        .status(401)
        .json({ success: false, error: "invalid_credentials" });
    }
    const user = ures.data[0];
    // only allow admins (super/community/community_admin/admin)
    if (
      !["super", "community", "community_admin", "admin"].includes(user.role)
    ) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }
    // verify password
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256").update(password).digest("hex");
    if (user.passwordHash !== hash) {
      return res
        .status(401)
        .json({ success: false, error: "invalid_credentials" });
    }
    // issue token and save on user document (top-level field)
    const token = require("crypto").randomBytes(16).toString("hex");
    try {
      await db.collection("users").doc(user._id).update({
        token,
        updatedAt: new Date(),
      });
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, error: err.message || err });
    }
    return res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        communityId: user.communityId || null,
        isPrimaryAdmin: user.isPrimaryAdmin || false,
        permissions: user.permissions || [],
        name: user.name || "",
      },
      mustChangePassword: !!user.mustChangePassword,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});
*/
// ===== 登录路由迁移完成 =====

// 列表：代理调用 cloudfunction adminListBindings
app.get("/api/bindings", async (req, res) => {
  try {
    const token = req.header("authorization")
      ? req.header("authorization").replace("Bearer ", "")
      : req.query.adminToken || req.query.token;
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });

    const page = parseInt(req.query.page || "1", 10);
    const pageSize = parseInt(req.query.pageSize || "20", 10);
    const status = req.query.status;
    const communityName = req.query.communityName;

    const callRes = await tcb.callFunction({
      name: "adminListBindings",
      data: { adminToken: token, page, pageSize, status, communityName },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// 获取单条绑定
app.get("/api/bindings/:id", async (req, res) => {
  try {
    const token = req.header("authorization")
      ? req.header("authorization").replace("Bearer ", "")
      : null;
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });
    const bindingId = req.params.id;
    const callRes = await tcb.callFunction({
      name: "adminGetBinding",
      data: { adminToken: token, bindingId },
    });
    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// 审核（approve/reject）
app.patch("/api/bindings/:id", async (req, res) => {
  try {
    const token = req.header("authorization")
      ? req.header("authorization").replace("Bearer ", "")
      : null;
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });
    const bindingId = req.params.id;
    const { action, reason } = req.body || {};
    if (!action || (action !== "approve" && action !== "reject"))
      return res.status(400).json({ success: false, error: "invalid action" });

    const callRes = await tcb.callFunction({
      name: "adminUpdateBinding",
      data: { adminToken: token, bindingId, action, reason },
    });
    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// ===== 以下 communities 和 community-admins 路由已迁移到 routes/community.js，保留注释作为参考 =====
/*
// Communities CRUD
app.get("/api/communities", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    // allow public (unauth) listing for login dropdown; when token present and valid, return paginated detailed list
    const admin = await ensureAdmin(token);

    const page = parseInt(req.query.page || "1", 10);
    const pageSize = parseInt(req.query.pageSize || "50", 10);
    // build query from incoming querystring parameters
    const query = {
      name: req.query.name,
      region: req.query.region ? JSON.parse(req.query.region) : undefined,
      ownerName: req.query.ownerName,
      ownerPhone: req.query.ownerPhone,
      startFrom: req.query.startFrom,
      startTo: req.query.startTo,
      endFrom: req.query.endFrom,
      endTo: req.query.endTo,
      sortField: req.query.sortField,
      sortOrder: req.query.sortOrder,
    };

    const callRes = await tcb.callFunction({
      name: "adminListCommunities",
      data: {
        adminToken: admin ? token : undefined,
        page,
        pageSize,
        query,
        sortField: req.query.sortField,
        sortOrder: req.query.sortOrder,
      },
    });
    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

app.post("/api/communities", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });
    const community = req.body;
    // Only super-admin can create community entries
    if (admin.role !== "super") {
      return res.status(403).json({ success: false, error: "forbidden" });
    }
    // creation proceeds without debug logging in production
    const callRes = await tcb.callFunction({
      name: "adminCreateCommunity",
      data: { adminToken: token, community },
    });
    const result = callRes.result || callRes || {};
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

app.put("/api/communities/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });
    const communityId = req.params.id;
    const updates = req.body;
    const callRes = await tcb.callFunction({
      name: "adminUpdateCommunity",
      data: { adminToken: token, communityId, updates },
    });
    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

app.delete("/api/communities/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }
    const communityId = req.params.id;
    const callRes = await tcb.callFunction({
      name: "adminDeleteCommunity",
      data: { adminToken: token, communityId },
    });
    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// Get primary admin account for a community (username only)
app.get("/api/communities/:id/admin-account", async (req, res) => {
  try {
    // 禁止缓存，避免 304 导致前端取不到最新账号/密码
    res.header("Cache-Control", "no-store, no-cache, must-revalidate");
    res.header("Pragma", "no-cache");
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });
    const communityId = req.params.id;

    async function tryGetUsername() {
      // 1) 优先读 communities 文档的 adminUsername（现在创建时已写入）
      try {
        let c = null;
        try {
          const usingDoc = await db
            .collection("communities")
            .doc(communityId)
            .get();
          c = usingDoc && usingDoc.data ? usingDoc.data : null;
        } catch (_) {
          const usingWhere = await db
            .collection("communities")
            .where({ _id: communityId })
            .limit(1)
            .get();
          c = usingWhere && usingWhere.data && usingWhere.data[0];
        }
        if (c && c.adminUsername) return c.adminUsername;
      } catch (err) {
        // ignore
      }

      // 2) 若缺失则查询 users，优先 isPrimaryAdmin；并回填 adminUsername
      try {
        const ures = await db
          .collection("users")
          .where({ communityId })
          .limit(20)
          .get();
        if (ures && ures.data && ures.data.length) {
          const primary = ures.data.find((u) => u.isPrimaryAdmin);
          const candidate =
            primary ||
            [...ures.data].sort((a, b) => {
              const ta = new Date(a.createdAt || 0).getTime();
              const tb = new Date(b.createdAt || 0).getTime();
              return ta - tb;
            })[0];
          if (candidate && candidate.username) {
            try {
              await db.collection("communities").doc(communityId).update({
                adminUsername: candidate.username,
                updatedAt: new Date(),
              });
            } catch (e2) {
              // ignore
            }
            return candidate.username;
          }
        }
      } catch (err) {
        // ignore
      }
      return "";
    }

    async function tryGetInitialPlainPassword() {
      try {
        let c = null;
        try {
          const usingDoc = await db
            .collection("communities")
            .doc(communityId)
            .get();
          c = usingDoc && usingDoc.data ? usingDoc.data : null;
        } catch (_) {
          const usingWhere = await db
            .collection("communities")
            .where({ _id: communityId })
            .limit(1)
            .get();
          c = usingWhere && usingWhere.data && usingWhere.data[0];
        }
        if (c && c.adminPasswordPlain) return c.adminPasswordPlain;
      } catch (err) {
        // ignore
      }
      return "";
    }

    const [username, initialPassword] = await Promise.all([
      tryGetUsername(),
      tryGetInitialPlainPassword(),
    ]);
    return res.json({ success: true, username, initialPassword });
  } catch (e) {
    return res
      .status(200)
      .json({ success: false, error: e.message || String(e) });
  }
});

// Update primary admin account; support username change and password reset
app.put("/api/communities/:id/admin-account", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });
    const communityId = req.params.id;
    const { username, reset, newPassword } = req.body || {};
    if (!username && !reset && !newPassword)
      return res.status(400).json({ success: false, error: "missing_params" });

    // find primary admin user
    const ures = await db
      .collection("users")
      .where({ communityId, isPrimaryAdmin: true })
      .limit(1)
      .get();
    let user = ures && ures.data && ures.data[0];
    // If no primary admin exists, adopt or create one on the fly
    if (!user) {
      // determine username to create
      let targetUsername = (username || "").trim();
      if (!targetUsername) {
        // try from community document
        try {
          const cdoc = await db
            .collection("communities")
            .doc(communityId)
            .get();
          if (cdoc && cdoc.data && cdoc.data.adminUsername) {
            targetUsername = cdoc.data.adminUsername;
          }
        } catch (_) {}
      }
      if (!targetUsername) {
        targetUsername = `admin_${String(communityId).slice(-4)}`;
      }
      // Prefer adopting existing user in the SAME community
      const existSame = await db
        .collection("users")
        .where({ username: targetUsername, communityId })
        .limit(1)
        .get();
      // Determine password now
      let finalPlain = newPassword || null;
      if (!finalPlain) {
        try {
          const cdoc = await db
            .collection("communities")
            .doc(communityId)
            .get();
          if (cdoc && cdoc.data && cdoc.data.adminPasswordPlain) {
            finalPlain = cdoc.data.adminPasswordPlain;
          }
        } catch (_) {}
      }
      if (!finalPlain) {
        finalPlain = String(Math.floor(10000000 + Math.random() * 90000000));
      }
      const crypto = require("crypto");
      const passwordHash = crypto
        .createHash("sha256")
        .update(finalPlain)
        .digest("hex");

      if (existSame && existSame.data && existSame.data.length) {
        // Adopt this user as primary admin
        const adopt = existSame.data[0];
        await db.collection("users").doc(adopt._id).update({
          role: "community",
          isPrimaryAdmin: true,
          passwordHash,
          mustChangePassword: false,
          updatedAt: new Date(),
        });
        try {
          await db
            .collection("communities")
            .doc(communityId)
            .update({ adminUsername: targetUsername, updatedAt: new Date() });
        } catch (_) {}
        return res.json({ success: true, newPassword: finalPlain });
      }

      // If username exists but belongs to another community, choose an alternative
      const existOther = await db
        .collection("users")
        .where({ username: targetUsername })
        .limit(1)
        .get();
      if (
        existOther &&
        existOther.data &&
        existOther.data.length &&
        existOther.data[0].communityId !== communityId
      ) {
        // auto-generate a unique alternative username
        let alt = `${targetUsername}${Math.floor(Math.random() * 1000)}`;
        try {
          const checkAlt = await db
            .collection("users")
            .where({ username: alt })
            .limit(1)
            .get();
          if (checkAlt && checkAlt.data && checkAlt.data.length) {
            alt = `${targetUsername}${Math.floor(Math.random() * 10000)}`;
          }
        } catch (_) {}
        targetUsername = alt;
      }

      const now = new Date();
      const addRes = await db.collection("users").add({
        data: {
          username: targetUsername,
          passwordHash,
          role: "community",
          communityId,
          mustChangePassword: false,
          isPrimaryAdmin: true,
          createdAt: now,
          updatedAt: now,
        },
      });
      try {
        await db
          .collection("communities")
          .doc(communityId)
          .update({ adminUsername: targetUsername, updatedAt: new Date() });
      } catch (_) {}
      return res.json({
        success: true,
        newPassword: newPassword ? newPassword : finalPlain,
      });
    }

    const updates = { updatedAt: new Date() };
    // username change
    if (username && username !== user.username) {
      const exist = await db
        .collection("users")
        .where({ username })
        .limit(1)
        .get();
      if (exist && exist.data && exist.data.length > 0) {
        return res
          .status(400)
          .json({ success: false, error: "username_taken" });
      }
      updates["username"] = username;
      try {
        await db
          .collection("communities")
          .doc(communityId)
          .update({ adminUsername: username, updatedAt: new Date() });
      } catch (_) {}
    }

    let revealedPassword = null;
    if (reset || newPassword) {
      const gen = () =>
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-4).toUpperCase();
      const finalPassword = newPassword || gen();
      const crypto = require("crypto");
      const passwordHash = crypto
        .createHash("sha256")
        .update(finalPassword)
        .digest("hex");
      updates["passwordHash"] = passwordHash;
      updates["mustChangePassword"] = false; // 重置后不强制改密
      revealedPassword = finalPassword;
    }

    await db.collection("users").doc(user._id).update(updates);
    return res.json({ success: true, newPassword: revealedPassword });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// ===== 以下用户管理路由已迁移到 routes/user.js，保留注释作为参考 =====
/*
// Change password for current user (or admin acting on userId)
app.post("/api/users/:id/change-password", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const caller = await ensureAdmin(token);
    if (!caller)
      return res.status(401).json({ success: false, error: "unauthorized" });
    const userId = req.params.id;
    const { newPassword } = req.body || {};
    if (!newPassword)
      return res.status(400).json({ success: false, error: "missing_params" });
    // Only self or super admin can change via this endpoint
    if (caller._id !== userId && caller.role !== "super") {
      return res.status(403).json({ success: false, error: "forbidden" });
    }
    const crypto = require("crypto");
    const passwordHash = crypto
      .createHash("sha256")
      .update(newPassword)
      .digest("hex");
    await db.collection("users").doc(userId).update({
      passwordHash,
      mustChangePassword: false,
      updatedAt: new Date(),
    });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// Users
app.get("/api/users", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });

    const page = parseInt(req.query.page || "1", 10);
    const pageSize = parseInt(req.query.pageSize || "50", 10);
    const query = { name: req.query.name, openid: req.query.openid };

    const callRes = await tcb.callFunction({
      name: "adminListUsers",
      data: { adminToken: token, page, pageSize, query },
    });
    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// Public registration for community admins (requires SMS code verification)
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, phone, communityName, region, verifyCode } =
      req.body || {};
    if (!username || !password || !phone || !communityName || !verifyCode) {
      return res.status(400).json({ success: false, error: "missing_params" });
    }

    // verify SMS code: find latest matching code for phone
    const codes = await db
      .collection("sms_codes")
      .where({ phone })
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();
    if (!codes || !codes.data || codes.data.length === 0) {
      return res.status(401).json({ success: false, error: "invalid_code" });
    }
    const match = codes.data.find(
      (item) =>
        item.code === verifyCode && new Date(item.expiresAt) > new Date()
    );
    if (!match)
      return res.status(401).json({ success: false, error: "invalid_code" });

    // find community by exact name
    const q = {};
    q.name = communityName;
    const cRes = await db.collection("communities").where(q).limit(1).get();
    if (!cRes || !cRes.data || cRes.data.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "community_not_open" });
    }
    const community = cRes.data[0];
    const communityId = community._id;
    const maxAdmins = community.maxAdmins || 10;

    // count current community admins
    const cnt = await db
      .collection("users")
      .where({ role: "community", communityId })
      .count();
    const current = (cnt && cnt.total) || 0;
    if (current >= maxAdmins) {
      return res
        .status(400)
        .json({ success: false, error: "max_admins_reached" });
    }

    // check username uniqueness
    const exists = await db
      .collection("users")
      .where({ username })
      .limit(1)
      .get();
    if (exists && exists.data && exists.data.length > 0) {
      return res.status(400).json({ success: false, error: "username_taken" });
    }

    // create user with hashed password
    const crypto = require("crypto");
    const passwordHash = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    const now = new Date();
    const addRes = await db.collection("users").add({
      data: {
        username,
        passwordHash,
        phone,
        role: "community",
        communityId,
        createdAt: now,
        updatedAt: now,
      },
    });

    return res.json({ success: true, id: addRes.id });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

app.patch("/api/users/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });
    const userId = req.params.id;
    const updates = req.body;
    const callRes = await tcb.callFunction({
      name: "adminUpdateUser",
      data: { adminToken: token, userId, updates },
    });
    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// Export bindings CSV
app.get("/api/export/bindings", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });
    const filters = req.query || {};
    // call cloud function
    const callRes = await tcb.callFunction({
      name: "adminExportBindingsCSV",
      data: { adminToken: token, filters },
    });
    const result = callRes.result || callRes;
    if (!result || !result.success) return res.status(500).json(result);
    const csv = result.csv || "";
    const filename = `bindings_export_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "_")}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});
*/

// ===== 以下已迁移到 routes/community.js =====
/*
// ==================== Community Admin Management ====================
// List community admins
app.get("/api/community-admins", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });

    // 获取当前用户的小区ID
    const communityId = admin.communityId || req.query.communityId;
    if (!communityId) {
      return res
        .status(400)
        .json({ success: false, error: "missing communityId" });
    }

    const {
      page = 1,
      pageSize = 50,
      department,
      position,
      name,
      phone,
      username,
    } = req.query;
    const callRes = await tcb.callFunction({
      name: "communityAdminList",
      data: {
        adminToken: token,
        communityId,
        page: +page,
        pageSize: +pageSize,
        department: department ? decodeURIComponent(department) : undefined,
        position: position ? decodeURIComponent(position) : undefined,
        name: name ? decodeURIComponent(name) : undefined,
        phone: phone ? decodeURIComponent(phone) : undefined,
        username: username ? decodeURIComponent(username) : undefined,
      },
    });
    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// Create community admin
app.post("/api/community-admins", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });

    const communityId = admin.communityId || req.body.communityId;
    if (!communityId) {
      return res
        .status(400)
        .json({ success: false, error: "missing communityId" });
    }

    const callRes = await tcb.callFunction({
      name: "communityAdminCreate",
      data: { adminToken: token, communityId, admin: req.body },
    });
    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// Delete community admin
app.delete("/api/community-admins/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });

    const adminId = req.params.id;
    const callRes = await tcb.callFunction({
      name: "communityAdminDelete",
      data: { adminToken: token, adminId },
    });
    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// Update community admin account (username/password)
app.put("/api/community-admins/:id/account", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });

    const adminId = req.params.id;
    const { username, newPassword, reset } = req.body;
    const callRes = await tcb.callFunction({
      name: "communityAdminUpdateAccount",
      data: { adminToken: token, adminId, username, newPassword, reset },
    });
    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// Get community admin account info
app.get("/api/community-admins/:id/account", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });

    res.header("Cache-Control", "no-store, no-cache, must-revalidate");
    const adminId = req.params.id;
    const userRes = await db.collection("users").doc(adminId).get();
    if (!userRes || !userRes.data || userRes.data.length === 0) {
      return res.status(404).json({ success: false, error: "not_found" });
    }
    const user = userRes.data[0];
    return res.json({
      success: true,
      username: user.username || "",
      name: user.name || "",
      phone: user.phone || "",
      department: user.department || "",
      position: user.position || "",
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// Update community admin permissions
app.put("/api/community-admins/:id/permissions", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    if (!admin)
      return res.status(401).json({ success: false, error: "unauthorized" });

    const adminId = req.params.id;
    const { permissions } = req.body;
    const callRes = await tcb.callFunction({
      name: "communityAdminUpdatePermissions",
      data: { adminToken: token, adminId, permissions },
    });
    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});
*/

// ===== 以下投票管理路由已迁移到 routes/vote.js，保留注释作为参考 =====
/*
// ============ Vote Management ============

// GET /api/votes - List votes
app.get("/api/votes", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const {
      communityId,
      type,
      title,
      initiator,
      publishTimeStart,
      publishTimeEnd,
      deadlineTimeStart,
      deadlineTimeEnd,
    } = req.query;

    const callRes = await tcb.callFunction({
      name: "listVotes",
      data: {
        communityId: communityId
          ? decodeURIComponent(communityId)
          : user.communityId,
        type: type ? decodeURIComponent(type) : undefined,
        title: title ? decodeURIComponent(title) : undefined,
        initiator: initiator ? decodeURIComponent(initiator) : undefined,
        publishTimeStart: publishTimeStart
          ? decodeURIComponent(publishTimeStart)
          : undefined,
        publishTimeEnd: publishTimeEnd
          ? decodeURIComponent(publishTimeEnd)
          : undefined,
        deadlineTimeStart: deadlineTimeStart
          ? decodeURIComponent(deadlineTimeStart)
          : undefined,
        deadlineTimeEnd: deadlineTimeEnd
          ? decodeURIComponent(deadlineTimeEnd)
          : undefined,
      },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// POST /api/votes - Create vote
app.post("/api/votes", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const {
      communityId,
      type,
      title,
      detail,
      attachment,
      attachmentName,
      initiator,
      publishTime,
      deadlineTime,
      description,
      showResult,
    } = req.body;

    const callRes = await tcb.callFunction({
      name: "createVote",
      data: {
        communityId: communityId || user.communityId,
        type,
        title,
        detail,
        attachment,
        attachmentName,
        initiator,
        publishTime,
        deadlineTime,
        description,
        showResult,
      },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// GET /api/votes/:id/statistics - Get vote statistics
app.get("/api/votes/:id/statistics", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;

    const callRes = await tcb.callFunction({
      name: "getVoteStatistics",
      data: { voteId: id },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// PUT /api/votes/:id/pause - Pause vote
app.put("/api/votes/:id/pause", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;

    const callRes = await tcb.callFunction({
      name: "updateVote",
      data: { voteId: id, action: "pause" },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// PUT /api/votes/:id/resume - Resume vote
app.put("/api/votes/:id/resume", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;

    const callRes = await tcb.callFunction({
      name: "updateVote",
      data: { voteId: id, action: "resume" },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// PUT /api/votes/:id/deadline - Update deadline
app.put("/api/votes/:id/deadline", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;
    const { deadlineTime } = req.body;

    const callRes = await tcb.callFunction({
      name: "updateVote",
      data: { voteId: id, action: "updateDeadline", deadlineTime },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// PUT /api/votes/:id/show-result - Toggle show result
app.put("/api/votes/:id/show-result", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;
    const { showResult } = req.body;

    const callRes = await tcb.callFunction({
      name: "updateVote",
      data: { voteId: id, action: "toggleShowResult", showResult },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});
*/

// ===== 以下文件上传路由已迁移到 routes/upload.js =====
/*
// POST /api/upload - Upload file
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    if (!req.file) {
      return res.status(400).json({ success: false, error: "no_file" });
    }

    // 生成唯一文件名
    const ext = path.extname(req.file.originalname);
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2);
    const filename = `vote-attachments/${timestamp}-${random}${ext}`;

    // 上传到云存储
    const result = await tcb.uploadFile({
      cloudPath: filename,
      fileContent: req.file.buffer,
    });

    if (!result || !result.fileID) {
      return res
        .status(500)
        .json({ success: false, error: "upload_to_cloud_failed" });
    }

    // 获取临时下载链接（有效期7天）
    let fileUrl = result.fileID;
    try {
      const tempUrlRes = await tcb.getTempFileURL({
        fileList: [result.fileID],
        maxAge: 604800, // 7天
      });

      if (
        tempUrlRes &&
        tempUrlRes.fileList &&
        tempUrlRes.fileList[0] &&
        tempUrlRes.fileList[0].tempFileURL
      ) {
        fileUrl = tempUrlRes.fileList[0].tempFileURL;
      }
    } catch (urlErr) {
      console.warn("Failed to get temp URL, using fileID:", urlErr.message);
      // 使用 fileID 作为 fallback
    }

    return res.json({
      success: true,
      url: fileUrl,
      fileID: result.fileID,
      name: req.file.originalname,
    });
  } catch (e) {
    console.error("Upload error:", e);
    return res.status(500).json({
      success: false,
      error: e.message || "Upload failed",
    });
  }
});
*/

// ===== 以下房屋配置路由已迁移到 routes/house.js =====
/*
// ============ 房屋配置接口 ============
// GET /api/house-config - 获取房屋配置
app.get("/api/house-config", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const configRes = await db
      .collection("house_config")
      .where({ communityId: user.communityId })
      .limit(1)
      .get();

    const config =
      configRes.data && configRes.data[0] ? configRes.data[0] : null;

    return res.json({
      success: true,
      config: config || { buildings: [] },
    });
  } catch (e) {
    console.error("获取房屋配置失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// POST /api/house-config - 保存房屋配置
app.post("/api/house-config", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { buildings } = req.body;

    if (!buildings || !Array.isArray(buildings)) {
      return res.status(400).json({ success: false, error: "invalid_data" });
    }

    // 检查是否已存在配置
    const existingRes = await db
      .collection("house_config")
      .where({ communityId: user.communityId })
      .limit(1)
      .get();

    const now = new Date().toISOString();
    const configData = {
      communityId: user.communityId,
      buildings,
      updatedAt: now,
    };

    if (existingRes.data && existingRes.data.length > 0) {
      // 更新
      await db
        .collection("house_config")
        .doc(existingRes.data[0]._id)
        .update(configData);
    } else {
      // 新增
      configData.createdAt = now;
      await db.collection("house_config").add({ data: configData });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("保存房屋配置失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});
*/

// ===== 以下业主名册路由已迁移到 routes/owner.js =====
/*
// ============ 业主名册接口 ============
// GET /api/owner-registry - 获取业主名册列表
app.get("/api/owner-registry", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const {
      name,
      district,
      building,
      unit,
      room,
      status,
      certStatus,
      realNameStatus,
    } = req.query;

    // 构建查询条件
    let query = { communityId: user.communityId };
    if (name) query.ownerName1 = new RegExp(name, "i");
    if (district) query.district = district;
    if (building) query.building = building;
    if (unit) query.unit = unit;
    if (room) query.room = room;
    if (status) query.status = status;

    const countRes = await db.collection("owner_registry").where(query).count();
    const total = countRes.total || 0;

    const list = await db
      .collection("owner_registry")
      .where(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 为每条记录查询认证状态和实名状态
    const enrichedData = await Promise.all(
      (list.data || []).map(async (record) => {
        // 查询认证状态（从certification_applications和owner_list）
        let registrationStatus = "none"; // none, pending, approved, rejected
        let realNameStatusValue = "unverified"; // unverified, pending, verified

        // 先查询certification_applications（只查户主类型）
        // 规范化房号信息以进行匹配（移除"栋"、"单元"等后缀）
        const normalizeBuilding = (str) =>
          String(str)
            .replace(/[栋幢]/g, "")
            .trim();
        const normalizeUnit = (str) =>
          String(str)
            .replace(/[单元]/g, "")
            .trim();
        const normalizeRoom = (str) => String(str).trim();

        const certRes = await db
          .collection("certification_applications")
          .where({
            communityId: user.communityId,
            type: "owner",
          })
          .get();

        // 在内存中匹配，因为需要规范化比较
        const matchedCert = certRes.data?.find(
          (cert) =>
            normalizeBuilding(cert.building) ===
              normalizeBuilding(record.building) &&
            normalizeUnit(cert.unit) === normalizeUnit(record.unit) &&
            normalizeRoom(cert.room) === normalizeRoom(record.room)
        );

        if (matchedCert) {
          registrationStatus = matchedCert.status || "pending";
        }

        // 查询owner_list获取实名认证状态
        const ownerRes = await db
          .collection("owner_list")
          .where({
            communityId: user.communityId,
          })
          .get();

        // 在内存中匹配
        const matchedOwner = ownerRes.data?.find(
          (owner) =>
            normalizeBuilding(owner.building) ===
              normalizeBuilding(record.building) &&
            normalizeUnit(owner.unit) === normalizeUnit(record.unit) &&
            normalizeRoom(owner.room) === normalizeRoom(record.room)
        );

        if (matchedOwner) {
          realNameStatusValue = matchedOwner.realNameStatus || "unverified";
          // 只要在owner_list中存在，就说明已经通过注册认证
          registrationStatus = "approved";
        }

        return {
          ...record,
          registrationStatus,
          realNameStatusValue,
        };
      })
    );

    // 如果有认证状态或实名状态筛选，需要在内存中过滤
    let filteredData = enrichedData;
    if (certStatus) {
      filteredData = filteredData.filter(
        (item) => item.registrationStatus === certStatus
      );
    }
    if (realNameStatus) {
      filteredData = filteredData.filter(
        (item) => item.realNameStatusValue === realNameStatus
      );
    }

    return res.json({
      success: true,
      data: filteredData,
      total: certStatus || realNameStatus ? filteredData.length : total,
    });
  } catch (e) {
    console.error("获取房屋清册失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// POST /api/owner-registry - 添加单个业主
app.post("/api/owner-registry", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const {
      ownerName1,
      ownerName2,
      district,
      building,
      unit,
      room,
      carNumber,
      area,
      status,
    } = req.body;

    if (!ownerName1 || !building || !unit || !room) {
      return res.status(400).json({ success: false, error: "missing_fields" });
    }

    // 检查是否已存在
    const existing = await db
      .collection("owner_registry")
      .where({
        communityId: user.communityId,
        building,
        unit,
        room,
      })
      .limit(1)
      .get();

    if (existing.data && existing.data.length > 0) {
      return res.status(400).json({ success: false, error: "该房号已存在" });
    }

    await db.collection("owner_registry").add({
      communityId: user.communityId,
      ownerName1,
      ownerName2: ownerName2 || "",
      district: district || "",
      building,
      unit,
      room,
      carNumber: carNumber || "",
      area: parseFloat(area) || 0,
      status: status || "valid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return res.json({ success: true });
  } catch (e) {
    console.error("添加业主失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// POST /api/owner-registry/import - 批量导入房屋清册
app.post("/api/owner-registry/import", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { data: importData } = req.body;

    if (!Array.isArray(importData) || importData.length === 0) {
      return res.status(400).json({ success: false, error: "invalid_data" });
    }

    let addCount = 0;
    let skipCount = 0;
    let failCount = 0;
    const errors = [];
    const skipped = [];

    for (const item of importData) {
      try {
        const {
          ownerName1,
          ownerName2,
          district,
          building,
          unit,
          room,
          carNumber,
          area,
          rowNumber,
        } = item;

        // 验证必填字段
        if (!ownerName1 || !building || !unit || !room) {
          errors.push({
            row: rowNumber,
            error: "缺少必填字段(户主姓名1、栋号、单元号、房号)",
          });
          failCount++;
          continue;
        }

        // 检查是否已存在
        const existing = await db
          .collection("owner_registry")
          .where({
            communityId: user.communityId,
            building: building.toString(),
            unit: unit.toString(),
            room: room.toString(),
          })
          .limit(1)
          .get();

        if (existing.data && existing.data.length > 0) {
          // 已存在,跳过
          skipped.push({
            row: rowNumber,
            info: `${building}栋${unit}单元${room}室已存在`,
          });
          skipCount++;
        } else {
          // 新增
          await db.collection("owner_registry").add({
            communityId: user.communityId,
            ownerName1,
            ownerName2: ownerName2 || "",
            district: district || "",
            building: building.toString(),
            unit: unit.toString(),
            room: room.toString(),
            carNumber: carNumber || "",
            area: parseFloat(area) || 0,
            status: "valid",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          addCount++;
        }
      } catch (err) {
        errors.push({
          row: item.rowNumber,
          error: err.message || "导入失败",
        });
        failCount++;
      }
    }

    return res.json({
      success: true,
      addCount,
      skipCount,
      failCount,
      errors,
      skipped,
    });
  } catch (e) {
    console.error("批量导入失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// PUT /api/owner-registry/:id - 更新业主信息
app.put("/api/owner-registry/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;
    const {
      ownerName1,
      ownerName2,
      district,
      building,
      unit,
      room,
      carNumber,
      area,
      status,
    } = req.body;

    await db
      .collection("owner_registry")
      .doc(id)
      .update({
        ownerName1,
        ownerName2: ownerName2 || "",
        district: district || "",
        building,
        unit,
        room,
        carNumber: carNumber || "",
        area: parseFloat(area) || 0,
        status: status || "valid",
        updatedAt: new Date().toISOString(),
      });

    return res.json({ success: true });
  } catch (e) {
    console.error("更新业主失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// DELETE /api/owner-registry/:id - 删除业主
app.delete("/api/owner-registry/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;
    await db.collection("owner_registry").doc(id).remove();

    return res.json({ success: true });
  } catch (e) {
    console.error("删除业主失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});
*/
// ===== owner-registry 路由迁移完成 =====

// ===== 以下认证和审核路由已迁移到 routes/certification.js =====
/*
// ============ 业主审核相关接口 ============
// GET /api/residents - 获取业主列表
app.get("/api/residents", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    // 查询该小区的所有绑定记录
    const query = db.collection("bindings").where({
      communityId: user.communityId,
    });
    const countRes = await query.count();
    const total = countRes.total || 0;

    const list = await query
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return res.json({
      success: true,
      data: list.data || [],
      total,
    });
  } catch (e) {
    console.error("获取业主列表失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// POST /api/residents/:id/audit - 审核业主
app.post("/api/residents/:id/audit", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;
    const { status, rejectReason } = req.body;

    // 验证status
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, error: "invalid_status" });
    }

    // 更新binding状态
    const updateData = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (status === "rejected") {
      updateData.rejectReason = rejectReason || "";
    }

    await db.collection("bindings").doc(id).update(updateData);

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// PUT /api/residents/:id - 修改业主信息
app.put("/api/residents/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;
    const {
      name,
      phone,
      building,
      block,
      room,
      residentialArea,
      commercialArea,
      parkingArea,
      carNumber,
    } = req.body;

    const updateData = {
      name,
      phone,
      building,
      block,
      room,
      residentialArea: parseFloat(residentialArea) || 0,
      commercialArea: parseFloat(commercialArea) || 0,
      parkingArea: parseFloat(parkingArea) || 0,
      carNumber,
      updatedAt: new Date().toISOString(),
    };

    await db.collection("bindings").doc(id).update(updateData);

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// DELETE /api/residents/:id - 删除业主
app.delete("/api/residents/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;
    await db.collection("bindings").doc(id).remove();

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// ============ 认证申请接口 ============
// GET /api/certification-applications - 获取认证申请列表
app.get("/api/certification-applications", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { name, district, building, unit, room, status } = req.query;

    let query = { communityId: user.communityId };

    // 只显示待审核和已拒绝的申请，不显示已通过的
    if (status && (status === "pending" || status === "rejected")) {
      query.status = status;
    } else {
      query.status = db.command.neq("approved");
    }

    if (name) query.name = new RegExp(name, "i");
    if (district) query.district = district;
    if (building) query.building = building;
    if (unit) query.unit = unit;
    if (room) query.room = room;

    const countRes = await db
      .collection("certification_applications")
      .where(query)
      .count();
    const total = countRes.total || 0;

    const list = await db
      .collection("certification_applications")
      .where(query)
      .orderBy("createdAt", "desc")
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return res.json({
      success: true,
      data: list.data || [],
      total,
    });
  } catch (e) {
    console.error("获取认证申请列表失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// POST /api/certification-applications/:id/review - 审核认证申请
app.post("/api/certification-applications/:id/review", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;
    const { action, reason } = req.body;

    if (!["approved", "rejected"].includes(action)) {
      return res.status(400).json({ success: false, error: "invalid_action" });
    }

    const updateData = {
      status: action,
      reviewedAt: new Date().toISOString(),
      reviewedBy: user._id,
      updatedAt: new Date().toISOString(),
    };

    if (action === "rejected") {
      updateData.rejectReason = reason || "";
    }

    await db
      .collection("certification_applications")
      .doc(id)
      .update(updateData);

    // 如果通过，将申请信息复制到户主名单
    if (action === "approved") {
      const appRes = await db
        .collection("certification_applications")
        .doc(id)
        .get();

      // CloudBase doc().get() 返回的数据可能在 data 数组中或直接在 data 对象中
      let app = null;
      if (appRes.data) {
        // 如果是数组，取第一个元素
        if (Array.isArray(appRes.data)) {
          app = appRes.data[0];
        } else {
          // 如果是对象，直接使用
          app = appRes.data;
        }
      }

      if (app) {
        // 从业主名册查询车牌号和专有面积
        let carNumber = "";
        let area = 0;
        try {
          // 去除单位后缀以匹配业主名册中的数据
          const removeUnit = (str) => {
            if (!str) return "";
            return String(str)
              .replace(/栋$/, "")
              .replace(/单元$/, "")
              .replace(/室$/, "")
              .trim();
          };

          const buildingClean = removeUnit(app.building);
          const unitClean = removeUnit(app.unit);
          const roomClean = removeUnit(app.room);

          const registryRes = await db
            .collection("owner_registry")
            .where({
              communityId: app.communityId,
              building: buildingClean,
              unit: unitClean,
              room: roomClean,
            })
            .limit(1)
            .get();

          if (registryRes.data && registryRes.data.length > 0) {
            const registryData = registryRes.data[0];
            carNumber = registryData.carNumber || "";
            area = parseFloat(registryData.area) || 0;
          }
        } catch (err) {
          console.warn("查询业主名册失败:", err);
          // 继续执行,使用默认值
        }

        try {
          const addResult = await db.collection("owner_list").add({
            communityId: app.communityId,
            name: app.name,
            phone: app.phone,
            district: app.district || "",
            building: app.building,
            unit: app.unit,
            room: app.room,
            carNumber: carNumber,
            area: area,
            openid: app.openid || "",
            realNameStatus: "unverified",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } catch (addErr) {
          console.error("添加到户主名单失败:", addErr);
          throw addErr;
        }
      }
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("审核失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// DELETE /api/certification-applications/:id - 删除认证申请
app.delete("/api/certification-applications/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;
    await db.collection("certification_applications").doc(id).remove();

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// ============ 自动审核配置接口 ============
// GET /api/auto-review-config - 获取自动审核配置
app.get("/api/auto-review-config", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const configRes = await db
      .collection("auto_review_config")
      .where({ communityId: user.communityId })
      .limit(1)
      .get();

    const enabled =
      configRes.data && configRes.data[0] ? configRes.data[0].enabled : false;

    return res.json({ success: true, enabled });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// POST /api/auto-review-config - 设置自动审核配置
app.post("/api/auto-review-config", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { enabled } = req.body;

    const existingRes = await db
      .collection("auto_review_config")
      .where({ communityId: user.communityId })
      .limit(1)
      .get();

    const now = new Date().toISOString();

    if (existingRes.data && existingRes.data.length > 0) {
      await db
        .collection("auto_review_config")
        .doc(existingRes.data[0]._id)
        .update({
          enabled,
          updatedAt: now,
        });
    } else {
      await db.collection("auto_review_config").add({
        data: {
          communityId: user.communityId,
          enabled,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// ============ 户主名单接口 ============
// GET /api/owner-list - 获取户主名单
app.get("/api/owner-list", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { name, district, building, unit, room, carNumber, realNameStatus } =
      req.query;

    let query = { communityId: user.communityId };
    if (name) query.name = new RegExp(name, "i");
    if (district) query.district = district;
    if (building) query.building = building;
    if (unit) query.unit = unit;
    if (room) query.room = room;
    if (carNumber) query.carNumber = new RegExp(carNumber, "i");
    if (realNameStatus) query.realNameStatus = realNameStatus;

    const countRes = await db.collection("owner_list").where(query).count();
    const total = countRes.total || 0;

    const list = await db
      .collection("owner_list")
      .where(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return res.json({
      success: true,
      data: list.data || [],
      total,
    });
  } catch (e) {
    console.error("获取户主名单失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// PUT /api/owner-list/:id - 修改户主信息
app.put("/api/owner-list/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;
    const { name, phone, district, building, unit, room } = req.body;

    await db
      .collection("owner_list")
      .doc(id)
      .update({
        name,
        phone,
        district: district || "",
        building,
        unit,
        room,
        updatedAt: new Date().toISOString(),
      });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// DELETE /api/owner-list/:id - 删除户主
app.delete("/api/owner-list/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;

    // 先获取户主信息，以便找到对应的认证申请记录
    const ownerRes = await db.collection("owner_list").doc(id).get();
    if (!ownerRes || !ownerRes.data || ownerRes.data.length === 0) {
      return res.status(404).json({ success: false, error: "户主不存在" });
    }

    const owner = ownerRes.data[0];

    // 删除户主记录
    await db.collection("owner_list").doc(id).remove();

    // 删除对应的认证申请记录，让用户失去绑定状态
    if (owner.openid) {
      try {
        const certRes = await db
          .collection("certification_applications")
          .where({
            openid: owner.openid,
            communityId: owner.communityId,
            status: "approved",
          })
          .get();

        if (certRes && certRes.data && certRes.data.length > 0) {
          // 删除所有匹配的认证记录
          for (const cert of certRes.data) {
            await db
              .collection("certification_applications")
              .doc(cert._id)
              .remove();
          }
        }
      } catch (certError) {
        console.error("删除认证申请记录失败:", certError);
        // 继续执行，不影响户主删除结果
      }
    }

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// POST /api/owner-list/:id/verify - 提交房屋实名认证
app.post("/api/owner-list/:id/verify", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token)
      return res.status(401).json({ success: false, error: "no_token" });

    const user = await ensureAdmin(token);
    if (!user)
      return res.status(401).json({ success: false, error: "invalid_token" });

    const { id } = req.params;

    // 这里应该处理文件上传，暂时简化
    await db.collection("owner_list").doc(id).update({
      realNameStatus: "pending",
      updatedAt: new Date().toISOString(),
    });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});
*/
// ===== 认证和审核路由迁移完成 =====

// ===== 所有业务路由已完全模块化，server.js 只保留服务器启动代码 =====

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`✅ Admin service listening on port ${PORT}`);
  console.log(`📅 启动时间: ${new Date().toLocaleString("zh-CN")}`);
  console.log(`🔧 Node 版本: ${process.version}`);
  console.log(`📁 工作目录: ${process.cwd()}`);

  // 启动自动审核定时任务
  startAutoReviewScheduler();
});

// 自动审核定时任务
function startAutoReviewScheduler() {
  const { db } = require("./config/db");

  console.log("🤖 启动自动审核定时任务（每1分钟执行一次）");

  setInterval(async () => {
    try {
      // 获取所有启用了自动审核的社区
      const configRes = await db
        .collection("auto_review_config")
        .where({ enabled: true })
        .get();

      if (!configRes.data || configRes.data.length === 0) {
        return; // 没有启用自动审核的社区
      }

      console.log(
        `⏰ 开始执行自动审核任务，共 ${configRes.data.length} 个社区`
      );

      // 为每个社区执行自动审核
      for (const config of configRes.data) {
        try {
          // 动态加载 certification 路由模块中的执行函数
          const certRoutes = require("./routes/certification");
          const result = await executeAutoReviewForCommunity(
            config.communityId
          );

          if (result.approvedCount > 0) {
            console.log(
              `✅ 社区 ${config.communityId} 自动审核: ${result.message}`
            );
          }
        } catch (err) {
          console.error(
            `❌ 社区 ${config.communityId} 自动审核失败:`,
            err.message
          );
        }
      }
    } catch (err) {
      console.error("❌ 自动审核定时任务执行失败:", err);
    }
  }, 60000); // 每60秒（1分钟）执行一次
}

// 自动审核执行函数（从 certification.js 复制）
async function executeAutoReviewForCommunity(communityId) {
  const { db } = require("./config/db");
  const {
    normalizeBuilding,
    normalizeUnit,
    normalizeRoom,
  } = require("./utils/helpers");

  // 1. 获取所有待审核的认证申请
  const pendingAppsRes = await db
    .collection("certification_applications")
    .where({
      communityId: communityId,
      type: "owner",
      status: "pending",
    })
    .get();

  if (!pendingAppsRes.data || pendingAppsRes.data.length === 0) {
    return { message: "没有待审核的申请", approvedCount: 0 };
  }

  // 2. 获取业主名册数据
  const ownerRegistryRes = await db
    .collection("owner_registry")
    .where({
      communityId: communityId,
    })
    .get();

  if (!ownerRegistryRes.data || ownerRegistryRes.data.length === 0) {
    return { message: "业主名册为空", approvedCount: 0 };
  }

  const ownerRegistry = ownerRegistryRes.data;
  let approvedCount = 0;
  const now = new Date().toISOString();

  // 3. 按姓名和手机号分组待审核申请
  const appsByUser = {};
  for (const app of pendingAppsRes.data) {
    const key = `${app.name}_${app.phone}`;
    if (!appsByUser[key]) {
      appsByUser[key] = [];
    }
    appsByUser[key].push(app);
  }

  // 4. 遍历每个用户的申请组
  for (const userKey in appsByUser) {
    const userApps = appsByUser[userKey];
    const userName = userApps[0].name;

    try {
      // 获取该用户在业主名册中的所有房产
      const userProperties = ownerRegistry.filter(
        (owner) => owner.ownerName1 === userName
      );

      if (userProperties.length === 0) {
        continue; // 该用户不在业主名册中，跳过
      }

      // 规范化业主名册中的房产
      const normalizedRegistry = userProperties.map((prop) => ({
        original: prop,
        normalized: {
          building: normalizeBuilding(prop.building),
          unit: normalizeUnit(prop.unit),
          room: normalizeRoom(prop.room),
        },
      }));

      // 检查用户申请的每套房产是否都能在名册中找到匹配
      let allMatched = true;
      const matchedApps = [];

      for (const app of userApps) {
        const normalizedApp = {
          building: normalizeBuilding(app.building),
          unit: normalizeUnit(app.unit),
          room: normalizeRoom(app.room),
        };

        // 在业主名册中查找匹配项
        const matched = normalizedRegistry.find(
          (reg) =>
            reg.normalized.building === normalizedApp.building &&
            reg.normalized.unit === normalizedApp.unit &&
            reg.normalized.room === normalizedApp.room
        );

        if (matched) {
          matchedApps.push({ app, matched: matched.original });
        } else {
          allMatched = false;
          break; // 有一套房产不匹配，整体不通过
        }
      }

      // 如果所有申请的房产都匹配，则自动通过
      if (allMatched && matchedApps.length > 0) {
        // 先获取该用户的openid和基本信息
        const firstApp = matchedApps[0].app;

        // 遍历业主名册中该用户的所有房产，全部添加到户主名单
        for (const registryItem of normalizedRegistry) {
          const prop = registryItem.original;

          // 检查该房产是否已存在于owner_list中
          const existingOwner = await db
            .collection("owner_list")
            .where({
              communityId: firstApp.communityId,
              name: firstApp.name,
              building: prop.building,
              unit: prop.unit,
              room: prop.room,
            })
            .limit(1)
            .get();

          if (existingOwner.data && existingOwner.data.length > 0) {
            // 该房产已存在，跳过
            continue;
          }

          // 添加到户主名单
          const ownerListData = {
            openid: firstApp.openid || null,
            communityId: firstApp.communityId,
            name: firstApp.name,
            phone: firstApp.phone,
            building: prop.building,
            unit: prop.unit,
            room: prop.room,
            area: prop.area || 0,
            carNumber: prop.carNumber || "",
            realNameStatus: "unverified",
            createdAt: now,
            updatedAt: now,
          };

          await db.collection("owner_list").add({ data: ownerListData });

          console.log(
            `✅ 添加到户主名单: ${firstApp.name} - ${prop.building}栋${prop.unit}单元${prop.room}室`
          );
          approvedCount++;
        }

        // 更新所有申请的状态为已通过
        for (const { app } of matchedApps) {
          await db
            .collection("certification_applications")
            .doc(app._id)
            .update({
              status: "approved",
              approvedAt: now,
              updatedAt: now,
              autoReviewed: true,
            });
        }
      }
    } catch (err) {
      console.error(`自动审核用户 ${userName} 失败:`, err);
      // 继续处理其他用户
    }
  }

  return {
    message: `自动审核完成，通过 ${approvedCount} 条申请`,
    approvedCount,
  };
}

// 服务器错误处理
server.on("error", (err) => {
  console.error("❌ 服务器错误:", err);
  if (err.code === "EADDRINUSE") {
    console.error(`端口 ${PORT} 已被占用，请更换端口或关闭占用该端口的进程`);
    process.exit(1);
  }
});

// 优雅关闭
process.on("SIGTERM", () => {
  console.log("📡 收到 SIGTERM 信号，正在关闭服务器...");
  server.close(() => {
    console.log("✅ 服务器已关闭");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n📡 收到 SIGINT 信号 (Ctrl+C)，正在关闭服务器...");
  server.close(() => {
    console.log("✅ 服务器已关闭");
    process.exit(0);
  });
});
