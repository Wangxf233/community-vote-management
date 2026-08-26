const express = require("express");
const crypto = require("crypto");
const { hashPassword, verifyPassword } = require("../utils/password");
const { tcb, db } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { getTokenFromReq } = require("../utils/helpers");

const router = express.Router();

/**
 * GET /api/users - 获取用户列表
 */
router.get("/users", authMiddleware, async (req, res) => {
  try {
    const token = getTokenFromReq(req);
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

/**
 * PATCH /api/users/:id - 更新用户信息
 */
router.patch("/users/:id", authMiddleware, async (req, res) => {
  try {
    const token = getTokenFromReq(req);
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

/**
 * POST /api/users/:id/change-password - 修改用户密码
 */
router.post("/users/:id/change-password", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const userId = req.params.id;
    const { oldPassword, newPassword } = req.body || {};

    if (!newPassword) {
      return res.status(400).json({ success: false, error: "missing_params" });
    }

    // 只有自己或超级管理员可以修改密码
    if (user._id !== userId && user.role !== "super") {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    // 如果提供了原始密码，需要验证原始密码是否正确
    if (oldPassword) {
      const userRes = await db.collection("users").doc(userId).get();
      if (!userRes || !userRes.data || userRes.data.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "user_not_found" });
      }

      const targetUser = userRes.data[0];
      const { valid: oldValid } = verifyPassword(oldPassword, targetUser);

      if (!oldValid) {
        return res
          .status(400)
          .json({ success: false, error: "invalid_old_password" });
      }
    }

    const passwordHash = hashPassword(newPassword);

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

/**
 * POST /api/register - 公开注册接口（小区管理员注册，需要短信验证）
 */
router.post("/register", async (req, res) => {
  try {
    const { username, password, phone, communityName, region, verifyCode } =
      req.body || {};

    if (!username || !password || !phone || !communityName || !verifyCode) {
      return res.status(400).json({ success: false, error: "missing_params" });
    }

    // 将有效期和验证码条件直接下推到 DB，避免内存过滤
    const codes = await db
      .collection("sms_codes")
      .where({ phone, code: verifyCode, expiresAt: db.command.gt(new Date()) })
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (!codes || !codes.data || codes.data.length === 0) {
      return res.status(401).json({ success: false, error: "invalid_code" });
    }

    // 并行查询小区信息和用户名唯一性（两者互不依赖）
    const q = { name: communityName };
    const [cRes, exists] = await Promise.all([
      db.collection("communities").where(q).limit(1).get(),
      db.collection("users").where({ username }).limit(1).get(),
    ]);

    if (!cRes || !cRes.data || cRes.data.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "community_not_open" });
    }

    if (exists && exists.data && exists.data.length > 0) {
      return res.status(400).json({ success: false, error: "username_taken" });
    }

    const community = cRes.data[0];
    const communityId = community._id;
    const maxAdmins = community.maxAdmins || 10;

    // 检查管理员数量限制
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

    // 创建用户
    const passwordHash = hashPassword(password);

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

module.exports = router;
