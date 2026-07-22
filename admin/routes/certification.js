const express = require("express");
const { db } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { getTokenFromReq } = require("../utils/helpers");
const {
  grantDoorAccess,
  revokeDoorAccess,
} = require("../utils/door-permissions");

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

    // 查询 binding 记录获取 openid 和 communityId，用于吊销门禁权限
    try {
      const bindingRes = await db.collection("bindings").doc(id).get();
      let binding = bindingRes && bindingRes.data ? bindingRes.data : null;
      if (Array.isArray(binding)) binding = binding[0] || null;
      if (binding && binding.openid && binding.communityId) {
        const certsRes = await db
          .collection("certification_applications")
          .where({
            openid: binding.openid,
            communityId: binding.communityId,
            doorAccessEnabled: true,
          })
          .get();
        for (const cert of certsRes.data || []) {
          revokeDoorAccess(cert).catch((err) =>
            console.error(
              `[cert] revokeDoorAccess failed for cert ${cert._id}:`,
              err.message,
            ),
          );
        }
      }
    } catch (revokeErr) {
      console.error(
        "[cert] revoke before resident delete failed:",
        revokeErr.message,
      );
    }

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

    // 只显示待审核和已拒绝的申请，不显示已通过和已删除的
    if (status && (status === "pending" || status === "rejected")) {
      query.status = status;
    } else {
      query.status = db.command.nin(["approved", "removed"]);
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
          const {
            normalizeBuilding,
            normalizeUnit,
            normalizeRoom,
          } = require("../utils/helpers");

          // 查询业主名册中该用户的所有房产（ownerName1 或 ownerName2 匹配即可）
          const _ = db.command;
          const ownerRegistryRes = await db
            .collection("owner_registry")
            .where(
              _.and([
                { communityId: app.communityId },
                _.or([{ ownerName1: app.name }, { ownerName2: app.name }]),
              ]),
            )
            .get();

          const matchedProperties = ownerRegistryRes.data || [];

          if (matchedProperties.length > 0) {
            // 业主名册中有该用户的房产，添加所有房产到户主名单
            const now = new Date().toISOString();

            for (const prop of matchedProperties) {
              // 检查该房产是否已存在于owner_list中
              const existingOwner = await db
                .collection("owner_list")
                .where({
                  communityId: app.communityId,
                  name: app.name,
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

              // 添加到户主名单，并从 owner_registry 恢复实名认证信息
              try {
                const newOwner = {
                  communityId: app.communityId,
                  name: app.name,
                  phone: app.phone,
                  district: app.district || "",
                  building: prop.building,
                  unit: prop.unit,
                  room: prop.room,
                  carNumber: prop.carNumber || "",
                  area: parseFloat(prop.area) || 0,
                  openid: app.openid || "",
                  realNameStatus: "unverified",
                  createdAt: now,
                  updatedAt: now,
                };

                // 从 owner_registry 恢复实名认证信息（如果存在）
                if (
                  prop.realNameStatus &&
                  prop.realNameStatus !== "unverified"
                ) {
                  newOwner.realNameStatus = prop.realNameStatus;
                  newOwner.realNameIdCardFront = prop.realNameIdCardFront || "";
                  newOwner.realNameIdCardBack = prop.realNameIdCardBack || "";
                  newOwner.realNameCertType = prop.realNameCertType || "";
                  newOwner.realNameCertImage = prop.realNameCertImage || "";
                  newOwner.realNameSubmitTime = prop.realNameSubmitTime || "";
                  newOwner.realNameRejectReason =
                    prop.realNameRejectReason || "";
                }

                await db.collection("owner_list").add(newOwner);
              } catch (addErr) {
                console.error("添加到户主名单失败:", addErr);
              }
            }
          } else {
            // 业主名册中没有该用户，仅添加申请的房产
            try {
              await db.collection("owner_list").add({
                communityId: app.communityId,
                name: app.name,
                phone: app.phone,
                district: app.district || "",
                building: app.building,
                unit: app.unit,
                room: app.room,
                carNumber: "",
                area: 0,
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

          // 若小区开启了门禁功能，自动为该业主分配门禁权限
          try {
            const commRes = await db
              .collection("communities")
              .doc(app.communityId)
              .get();
            const comm = Array.isArray(commRes.data)
              ? commRes.data[0]
              : commRes.data;
            if (comm && comm.doorManagementEnabled === true) {
              // 重新读取最新 cert（status 已更新）
              const freshCertRes = await db
                .collection("certification_applications")
                .doc(id)
                .get();
              let freshCert =
                freshCertRes && freshCertRes.data ? freshCertRes.data : null;
              if (Array.isArray(freshCert)) freshCert = freshCert[0] || null;
              if (freshCert) {
                grantDoorAccess(freshCert, freshCert.communityId).catch((err) =>
                  console.error(
                    `[cert] grantDoorAccess failed for cert ${id}:`,
                    err.message,
                  ),
                );
              }
            }
          } catch (doorErr) {
            console.error("[cert] door grant check failed:", doorErr.message);
          }
        }
      }

      return res.json({ success: true });
    } catch (e) {
      console.error("审核失败:", e);
      return res.status(500).json({ success: false, error: e.message || e });
    }
  },
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

      // 先读取认证记录，用于吊销门禁权限
      try {
        const certRes = await db
          .collection("certification_applications")
          .doc(id)
          .get();
        let cert = certRes && certRes.data ? certRes.data : null;
        if (Array.isArray(cert)) cert = cert[0] || null;
        if (cert) {
          await revokeDoorAccess(cert);
        }
      } catch (revokeErr) {
        console.error(
          "[cert] revokeDoorAccess before delete failed:",
          revokeErr.message,
        );
      }

      await db.collection("certification_applications").doc(id).remove();
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message || e });
    }
  },
);

module.exports = router;
