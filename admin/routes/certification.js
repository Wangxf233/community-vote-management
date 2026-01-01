const express = require("express");
const { db } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { getTokenFromReq } = require("../utils/helpers");

const router = express.Router();

// ============ 业主审核相关接口 ============

/**
 * GET /api/residents - 获取业主列表
 */
router.get("/residents", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
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

/**
 * POST /api/residents/:id/audit - 审核业主
 */
router.post("/residents/:id/audit", authMiddleware, async (req, res) => {
  try {
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

/**
 * PUT /api/residents/:id - 修改业主信息
 */
router.put("/residents/:id", authMiddleware, async (req, res) => {
  try {
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

/**
 * DELETE /api/residents/:id - 删除业主
 */
router.delete("/residents/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("bindings").doc(id).remove();

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// ============ 认证申请接口 ============

/**
 * GET /api/certification-applications - 获取认证申请列表
 */
router.get("/certification-applications", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
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

/**
 * POST /api/certification-applications/:id/review - 审核认证申请
 */
router.post(
  "/certification-applications/:id/review",
  authMiddleware,
  async (req, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const { action, reason } = req.body;

      if (!["approved", "rejected"].includes(action)) {
        return res
          .status(400)
          .json({ success: false, error: "invalid_action" });
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
            await db.collection("owner_list").add({
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
  }
);

/**
 * DELETE /api/certification-applications/:id - 删除认证申请
 */
router.delete(
  "/certification-applications/:id",
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection("certification_applications").doc(id).remove();

      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message || e });
    }
  }
);

// ============ 自动审核配置接口 ============

/**
 * GET /api/auto-review-config - 获取自动审核配置
 */
router.get("/auto-review-config", authMiddleware, async (req, res) => {
  try {
    const user = req.user;

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

/**
 * POST /api/auto-review-config - 设置自动审核配置
 */
router.post("/auto-review-config", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
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

module.exports = router;
