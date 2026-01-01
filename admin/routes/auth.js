const express = require("express");
const crypto = require("crypto");
const { db } = require("../config/db");

const router = express.Router();

/**
 * POST /api/login/sms - 短信验证码登录
 */
router.post("/login/sms", async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (!phone || !code)
      return res.status(400).json({ success: false, error: "missing_params" });

    // 查找该手机号的验证码
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

    // 查找用户
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

    // 生成 token
    const token = crypto.randomBytes(16).toString("hex");
    await db.collection("users").doc(user._id).update({
      token,
      updatedAt: new Date(),
    });

    return res.json({
      success: true,
      token,
      user: { _id: user._id, username: user.username, role: user.role },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/login/password - 用户名密码登录
 */
router.post("/login/password", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: "missing_params" });
    }

    // 查找用户
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

    // 只允许管理员角色
    if (
      !["super", "community", "community_admin", "admin"].includes(user.role)
    ) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    // 验证密码
    const hash = crypto.createHash("sha256").update(password).digest("hex");
    if (user.passwordHash !== hash) {
      return res
        .status(401)
        .json({ success: false, error: "invalid_credentials" });
    }

    // 生成 token
    const token = crypto.randomBytes(16).toString("hex");
    await db.collection("users").doc(user._id).update({
      token,
      updatedAt: new Date(),
    });

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

/**
 * GET /api/me - 获取当前登录用户信息（调试端点）
 */
router.get("/me", async (req, res) => {
  try {
    // 从请求头或查询参数中提取token
    const authHeader = req.header("authorization");
    let token = null;
    if (
      authHeader &&
      typeof authHeader === "string" &&
      authHeader.toLowerCase().startsWith("bearer ")
    ) {
      token = authHeader.replace(/^[Bb]earer\s+/, "");
    } else {
      token = req.query.adminToken || req.query.token || null;
    }

    if (!token) {
      return res.json({ success: false, error: "no_token" });
    }

    // 查找用户
    const res_user = await db
      .collection("users")
      .where({ token })
      .limit(1)
      .get();
    if (!res_user || !res_user.data || res_user.data.length === 0) {
      return res.status(401).json({ success: false, error: "invalid_token" });
    }

    const user = res_user.data[0];

    // 验证角色
    if (
      !["super", "community", "community_admin", "admin"].includes(user.role)
    ) {
      return res.status(401).json({ success: false, error: "invalid_token" });
    }

    return res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        communityId: user.communityId,
        isPrimaryAdmin: user.isPrimaryAdmin,
        permissions: user.permissions || [],
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

module.exports = router;
