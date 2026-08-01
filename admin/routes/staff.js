const express = require("express");
const router = express.Router();
const { db } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const _ = db.command;

// 所有端点都需要认证
router.use(authMiddleware);

/**
 * 构建 communityId 过滤条件
 * 小区管理员：强制限制在本小区；超管：不限制（除非 query 传了 communityId）
 */
function buildCommunityWhere(req, queryCommunityId) {
  const userRole = req.user.role;
  const userCommunityId = req.user.communityId;

  if (userRole === "community" || userRole === "community_admin") {
    if (!userCommunityId) {
      return null; // 无小区权限
    }
    return userCommunityId;
  }
  // 超管：可选 filter
  return queryCommunityId || null;
}

/**
 * GET /api/staff — 分页列表
 */
router.get("/", async (req, res) => {
  try {
    const { page = 1, pageSize = 10, name, phone, status, communityId: queryCommunityId } = req.query;
    const cid = buildCommunityWhere(req, queryCommunityId);

    if (cid === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }

    const where = {};
    if (cid) where.communityId = cid;
    if (name) where.name = db.RegExp({ regexp: name, options: "i" });
    if (phone) where.phone = phone;
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    const [countResult, result] = await Promise.all([
      db.collection("staff").where(where).count(),
      db.collection("staff").where(where).orderBy("createTime", "desc").skip(skip).limit(limit).get(),
    ]);

    res.json({ success: true, data: result.data, total: countResult.total });
  } catch (err) {
    console.error("获取员工列表失败:", err);
    res.status(500).json({ success: false, error: "获取员工列表失败" });
  }
});

/**
 * POST /api/staff/batch-delete — 批量删除
 */
router.post("/batch-delete", async (req, res) => {
  try {
    const cid = buildCommunityWhere(req);
    if (cid === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "请提供要删除的员工ID列表" });
    }

    const where = { _id: _.in(ids) };
    if (cid) where.communityId = cid;

    await db.collection("staff").where(where).remove();
    res.json({ success: true });
  } catch (err) {
    console.error("批量删除员工失败:", err);
    res.status(500).json({ success: false, error: "批量删除员工失败" });
  }
});

/**
 * PUT /api/staff/:id — 修改员工信息
 */
router.put("/:id", async (req, res) => {
  try {
    const cid = buildCommunityWhere(req);
    if (cid === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }
    const { id } = req.params;
    const { name, phone, position } = req.body;

    const where = { _id: id };
    if (cid) where.communityId = cid;

    const existing = await db.collection("staff").where(where).limit(1).get();
    if (!existing.data || existing.data.length === 0) {
      return res.status(404).json({ success: false, error: "员工不存在" });
    }

    const updates = { updateTime: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (position !== undefined) updates.position = position;

    await db.collection("staff").doc(id).update(updates);
    res.json({ success: true });
  } catch (err) {
    console.error("修改员工信息失败:", err);
    res.status(500).json({ success: false, error: "修改员工信息失败" });
  }
});

/**
 * POST /api/staff/:id/approve — 审核通过
 */
router.post("/:id/approve", async (req, res) => {
  try {
    const cid = buildCommunityWhere(req);
    if (cid === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }
    const { id } = req.params;

    const where = { _id: id };
    if (cid) where.communityId = cid;

    const existing = await db.collection("staff").where(where).limit(1).get();
    if (!existing.data || existing.data.length === 0) {
      return res.status(404).json({ success: false, error: "员工不存在" });
    }

    await db.collection("staff").doc(id).update({
      status: "approved",
      updateTime: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("审核员工失败:", err);
    res.status(500).json({ success: false, error: "审核员工失败" });
  }
});

/**
 * DELETE /api/staff/:id — 删除单个员工
 */
router.delete("/:id", async (req, res) => {
  try {
    const cid = buildCommunityWhere(req);
    if (cid === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }
    const { id } = req.params;

    const where = { _id: id };
    if (cid) where.communityId = cid;

    const existing = await db.collection("staff").where(where).limit(1).get();
    if (!existing.data || existing.data.length === 0) {
      return res.status(404).json({ success: false, error: "员工不存在" });
    }

    await db.collection("staff").doc(id).remove();
    res.json({ success: true });
  } catch (err) {
    console.error("删除员工失败:", err);
    res.status(500).json({ success: false, error: "删除员工失败" });
  }
});

module.exports = router;
