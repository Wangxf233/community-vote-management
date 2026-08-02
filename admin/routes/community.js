const express = require("express");
const crypto = require("crypto");
const { tcb, db } = require("../config/db");
const {
  authMiddleware,
  ensureAdmin,
  superAdminOnly,
} = require("../middleware/auth");
const { getTokenFromReq } = require("../utils/helpers");

const router = express.Router();

/**
 * GET /api/communities - 获取小区列表（允许未认证访问用于登录下拉）
 */
router.get("/communities", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const admin = await ensureAdmin(token);
    const page = parseInt(req.query.page || "1", 10);
    const pageSize = parseInt(req.query.pageSize || "50", 10);

    const q = {};
    if (req.query.name) q.name = req.query.name;
    // 过滤已删除的记录
    q.deleted = db.command.neq(true);

    const countRes = await db.collection("communities").where(q).count();
    const total = countRes.total || 0;

    const list = await db
      .collection("communities")
      .where(q)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return res.json({ success: true, data: list.data || [], total });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/communities - 创建小区（仅超级管理员）
 */
router.post("/communities", superAdminOnly, async (req, res) => {
  try {
    const user = req.user;
    const community = req.body;

    if (user.role !== "super") {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    const token = getTokenFromReq(req);
    const callRes = await tcb.callFunction({
      name: "adminCreateCommunity",
      data: { adminToken: token, community },
    });

    return res.json(callRes.result || callRes || {});
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PUT /api/communities/:id - 更新小区信息（仅超级管理员）
 */
router.put("/communities/:id", superAdminOnly, async (req, res) => {
  try {
    const token = getTokenFromReq(req);
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

/**
 * DELETE /api/communities/:id - 删除小区（仅超级管理员）
 */
router.delete("/communities/:id", superAdminOnly, async (req, res) => {
  try {
    const token = getTokenFromReq(req);
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

/**
 * GET /api/communities/:id/admin-account - 获取小区主管理员账号
 */
router.get(
  "/communities/:id/admin-account",
  authMiddleware,
  async (req, res) => {
    try {
      // 禁止缓存
      res.header("Cache-Control", "no-store, no-cache, must-revalidate");
      res.header("Pragma", "no-cache");

      const communityId = req.params.id;

      const tryGetUsername = async () => {
        try {
          const communityDoc = await db
            .collection("communities")
            .doc(communityId)
            .get();
          const c = communityDoc?.data;
          if (c?.adminUsername) return c.adminUsername;
        } catch (_) {}

        try {
          const ures = await db
            .collection("users")
            .where({ communityId })
            .limit(20)
            .get();
          if (ures?.data?.length) {
            const primary = ures.data.find((u) => u.isPrimaryAdmin);
            const candidate =
              primary ||
              [...ures.data].sort((a, b) => {
                return (
                  new Date(a.createdAt || 0).getTime() -
                  new Date(b.createdAt || 0).getTime()
                );
              })[0];

            if (candidate?.username) {
              try {
                await db.collection("communities").doc(communityId).update({
                  adminUsername: candidate.username,
                  updatedAt: new Date(),
                });
              } catch (_) {}
              return candidate.username;
            }
          }
        } catch (_) {}
        return "";
      };

      const tryGetInitialPlainPassword = async () => {
        try {
          const communityDoc = await db
            .collection("communities")
            .doc(communityId)
            .get();
          return communityDoc?.data?.adminPasswordPlain || "";
        } catch (_) {
          return "";
        }
      };

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
  },
);

/**
 * PUT /api/communities/:id/admin-account - 更新小区主管理员账号
 */
router.put(
  "/communities/:id/admin-account",
  authMiddleware,
  async (req, res) => {
    try {
      const communityId = req.params.id;
      const { username, reset, newPassword } = req.body || {};

      if (!username && !reset && !newPassword) {
        return res
          .status(400)
          .json({ success: false, error: "missing_params" });
      }

      // 查找主管理员
      const ures = await db
        .collection("users")
        .where({ communityId, isPrimaryAdmin: true })
        .limit(1)
        .get();

      const user = ures?.data?.[0];

      // 如果不存在主管理员，创建一个
      if (!user) {
        let targetUsername = username?.trim();
        let finalPlain = newPassword || null;

        // 两个字段都需要时一次读取，避免重复查询同一文档
        if (!targetUsername || !finalPlain) {
          try {
            const cdoc = await db
              .collection("communities")
              .doc(communityId)
              .get();
            if (!targetUsername) targetUsername = cdoc?.data?.adminUsername;
            if (!finalPlain) finalPlain = cdoc?.data?.adminPasswordPlain;
          } catch (_) {}
        }
        if (!targetUsername) {
          targetUsername = `admin_${String(communityId).slice(-4)}`;
        }
        if (!finalPlain) {
          finalPlain = String(Math.floor(10000000 + Math.random() * 90000000));
        }

        const passwordHash = crypto
          .createHash("sha256")
          .update(finalPlain)
          .digest("hex");

        // 尝试采用同小区的现有用户
        const existSame = await db
          .collection("users")
          .where({ username: targetUsername, communityId })
          .limit(1)
          .get();

        if (existSame?.data?.length) {
          await db.collection("users").doc(existSame.data[0]._id).update({
            role: "community",
            isPrimaryAdmin: true,
            passwordHash,
            mustChangePassword: false,
            updatedAt: new Date(),
          });

          try {
            await db.collection("communities").doc(communityId).update({
              adminUsername: targetUsername,
              updatedAt: new Date(),
            });
          } catch (_) {}

          return res.json({ success: true, newPassword: finalPlain });
        }

        // 创建新用户
        await db.collection("users").add({
          username: targetUsername,
          passwordHash,
          role: "community",
          communityId,
          isPrimaryAdmin: true,
          mustChangePassword: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        try {
          await db.collection("communities").doc(communityId).update({
            adminUsername: targetUsername,
            updatedAt: new Date(),
          });
        } catch (_) {}

        return res.json({ success: true, newPassword: finalPlain });
      }

      // 更新现有主管理员
      const updates = {};
      if (username && username !== user.username) {
        updates.username = username;
        try {
          await db.collection("communities").doc(communityId).update({
            adminUsername: username,
            updatedAt: new Date(),
          });
        } catch (_) {}
      }

      if (reset || newPassword) {
        const plainPwd =
          newPassword ||
          String(Math.floor(10000000 + Math.random() * 90000000));
        const passwordHash = crypto
          .createHash("sha256")
          .update(plainPwd)
          .digest("hex");
        updates.passwordHash = passwordHash;
        updates.mustChangePassword = false;

        await db
          .collection("users")
          .doc(user._id)
          .update({
            ...updates,
            updatedAt: new Date(),
          });

        return res.json({ success: true, newPassword: plainPwd });
      }

      if (Object.keys(updates).length > 0) {
        await db
          .collection("users")
          .doc(user._id)
          .update({
            ...updates,
            updatedAt: new Date(),
          });
      }

      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message || e });
    }
  },
);

/**
 * GET /api/community-admins - 获取小区管理员列表
 */
router.get("/community-admins", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page || "1", 10);
    const pageSize = parseInt(req.query.pageSize || "20", 10);

    const query = { communityId: user.communityId, role: "community_admin" };
    const countRes = await db.collection("users").where(query).count();
    const total = countRes.total || 0;

    const list = await db
      .collection("users")
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
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/community-admins - 创建小区管理员
 */
router.post("/community-admins", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const {
      username,
      name,
      permissions,
      department,
      position,
      phone,
      password,
    } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, error: "缺少用户名" });
    }

    // 检查用户名是否重复（全局唯一）
    const existing = await db
      .collection("users")
      .where({ username })
      .limit(1)
      .get();
    if (existing.data && existing.data.length > 0) {
      return res.status(409).json({ success: false, error: "账号名重复" });
    }

    const initialPassword =
      password && String(password).trim()
        ? String(password)
        : String(Math.floor(10000000 + Math.random() * 90000000));

    const passwordHash = crypto
      .createHash("sha256")
      .update(initialPassword)
      .digest("hex");

    // 默认所有权限
    const defaultPermissions = [
      "vote",
      "survey",
      "service_evaluation",
      "property_evaluation",
      "repair",
      "report",
      "announcement",
    ];

    await db.collection("users").add({
      username,
      name: name || "",
      phone: phone || "",
      department: department || "",
      position: position || "",
      passwordHash,
      role: "community_admin",
      communityId: user.communityId,
      permissions: permissions || defaultPermissions,
      mustChangePassword: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.json({ success: true, initialPassword });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PUT /api/community-admins/:id - 更新小区管理员基本信息
 */
router.put("/community-admins/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { department, position, name, phone } = req.body;

    const updateData = {
      updatedAt: new Date(),
    };

    if (department !== undefined) updateData.department = department;
    if (position !== undefined) updateData.position = position;
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;

    await db.collection("users").doc(id).update(updateData);

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * DELETE /api/community-admins/:id - 删除小区管理员
 */
router.delete("/community-admins/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("users").doc(id).remove();
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PUT /api/community-admins/:id/permissions - 更新管理员权限
 */
router.put(
  "/community-admins/:id/permissions",
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { permissions } = req.body;

      await db
        .collection("users")
        .doc(id)
        .update({
          permissions: permissions || [],
          updatedAt: new Date(),
        });

      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message || e });
    }
  },
);

/**
 * GET /api/community-admins/:id/account - 获取小区管理员账号信息
 */
router.get(
  "/community-admins/:id/account",
  authMiddleware,
  async (req, res) => {
    try {
      res.header("Cache-Control", "no-store, no-cache, must-revalidate");
      const { id } = req.params;

      const userRes = await db.collection("users").doc(id).get();
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
  },
);

/**
 * PUT /api/community-admins/:id/account - 更新小区管理员账号（用户名/密码）
 */
router.put(
  "/community-admins/:id/account",
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { username, newPassword, reset } = req.body;
      const crypto = require("crypto");

      const updateData = {
        updatedAt: new Date(),
      };

      // 更新用户名
      if (username !== undefined && username.trim()) {
        updateData.username = username.trim();
      }

      // 更新密码
      if (newPassword) {
        const hash = crypto
          .createHash("sha256")
          .update(newPassword)
          .digest("hex");
        updateData.passwordHash = hash;

        // 如果是重置密码，清除强制修改密码标记
        if (reset) {
          updateData.mustChangePassword = false;
        }
      }

      await db.collection("users").doc(id).update(updateData);

      return res.json({
        success: true,
        newPassword: newPassword || undefined,
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message || e });
    }
  },
);

module.exports = router;
