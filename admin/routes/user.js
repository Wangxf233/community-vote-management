const express = require("express");
const crypto = require("crypto");
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
    const { newPassword } = req.body || {};

    if (!newPassword) {
      return res.status(400).json({ success: false, error: "missing_params" });
    }

    // 只有自己或超级管理员可以修改密码
    if (user._id !== userId && user.role !== "super") {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

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

    // 验证短信验证码
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

    if (!match) {
      return res.status(401).json({ success: false, error: "invalid_code" });
    }

    // 查找小区
    const q = { name: communityName };
    const cRes = await db.collection("communities").where(q).limit(1).get();

    if (!cRes || !cRes.data || cRes.data.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "community_not_open" });
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

    // 检查用户名唯一性
    const exists = await db
      .collection("users")
      .where({ username })
      .limit(1)
      .get();

    if (exists && exists.data && exists.data.length > 0) {
      return res.status(400).json({ success: false, error: "username_taken" });
    }

    // 创建用户
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

module.exports = router;
