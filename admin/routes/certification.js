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
          const {
            normalizeBuilding,
            normalizeUnit,
            normalizeRoom,
          } = require("../utils/helpers");

          // 查询业主名册中该用户的所有房产
          const ownerRegistryRes = await db
            .collection("owner_registry")
            .where({
              communityId: app.communityId,
              ownerName1: app.name,
            })
            .get();

          if (ownerRegistryRes.data && ownerRegistryRes.data.length > 0) {
            // 业主名册中有该用户的房产，添加所有房产到户主名单
            const now = new Date().toISOString();

            for (const prop of ownerRegistryRes.data) {
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

              // 添加到户主名单
              try {
                await db.collection("owner_list").add({
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
                });
                console.log(
                  `✅ 手动审核-添加到户主名单: ${app.name} - ${prop.building}栋${prop.unit}单元${prop.room}室`
                );
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
    const docId = `config_${user.communityId}`;

    const configRes = await db
      .collection("auto_review_config")
      .doc(docId)
      .get();

    // 兼容两种可能的返回格式
    let enabled = false;
    if (Array.isArray(configRes.data) && configRes.data.length > 0) {
      enabled = configRes.data[0].enabled === true;
    } else if (configRes.data && typeof configRes.data === "object") {
      enabled = configRes.data.enabled === true;
    }

    return res.json({ success: true, enabled });
  } catch (e) {
    console.error("❌ 获取自动审核配置失败:", e);
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

    // 使用固定的文档ID（社区ID作为文档ID）
    const docId = `config_${user.communityId}`;
    const now = new Date().toISOString();

    // 直接使用 set 进行 upsert（不存在则创建，存在则覆盖）
    await db.collection("auto_review_config").doc(docId).set({
      communityId: user.communityId,
      enabled: enabled,
      updatedAt: now,
    });

    // 验证保存结果
    const verifyRes = await db
      .collection("auto_review_config")
      .doc(docId)
      .get();

    // 兼容两种可能的返回格式
    let actualEnabled = false;
    if (Array.isArray(verifyRes.data) && verifyRes.data.length > 0) {
      actualEnabled = verifyRes.data[0].enabled === true;
    } else if (verifyRes.data && typeof verifyRes.data === "object") {
      actualEnabled = verifyRes.data.enabled === true;
    }

    return res.json({ success: true, enabled: actualEnabled });
  } catch (e) {
    console.error("❌ 设置自动审核配置失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/auto-review-execute - 手动执行一次自动审核
 */
router.post("/auto-review-execute", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const result = await executeAutoReview(user.communityId);
    return res.json({ success: true, ...result });
  } catch (e) {
    console.error("自动审核执行失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * 执行自动审核逻辑
 */
async function executeAutoReview(communityId) {
  const {
    normalizeBuilding,
    normalizeUnit,
    normalizeRoom,
  } = require("../utils/helpers");

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

  // 3. 按姓名和openid分组待审核申请
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

module.exports = router;
