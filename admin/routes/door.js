const express = require("express");
const { db } = require("../config/db");
const { authMiddleware, superAdminOnly } = require("../middleware/auth");
const { FondcardClient } = require("../utils/fondcard-client");
const { addKeyToNewDevice } = require("../utils/door-permissions");

const router = express.Router();

function pickFirst(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    return value;
  }
  return undefined;
}

function normalizeNo(value) {
  if (value === undefined || value === null) {
    return "";
  }
  const str = String(value).trim();
  if (!str) {
    return "";
  }
  const digits = str.match(/\d+/g);
  if (!digits || !digits.length) {
    return str;
  }
  return String(parseInt(digits.join(""), 10));
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function buildUnitKey(building, unit) {
  const b = normalizeNo(building);
  const u = normalizeNo(unit);
  if (!b || !u) {
    return "";
  }
  return `${b}#${u}`;
}

function buildLocationLabel(device) {
  if (device.locationType === "unit_gate") {
    const bRaw = pickFirst(device.buildingLabel, device.building, "");
    const uRaw = pickFirst(device.unitLabel, device.unit, "");
    const b = String(bRaw || "").trim();
    const u = String(uRaw || "").trim();
    if (b && u) {
      const buildingPart = b.includes("栋") ? b : `${b}栋`;
      const unitPart = u.includes("单元") ? u : `${u}单元`;
      return `${buildingPart}${unitPart}`;
    }
  }
  return pickFirst(device.gateName, device.customLocation, device.location, "");
}

function toHex8(numValue) {
  const n = Number(numValue);
  if (!Number.isFinite(n)) return null;
  return n.toString(16).toUpperCase().padStart(8, "0").slice(-8);
}

function sanitizeDevicePayload(body = {}) {
  const locationType =
    body.locationType ||
    (buildUnitKey(body.building, body.unit) ? "unit_gate" : "community_gate");

  return {
    deviceName: pickFirst(body.deviceName, body.serial, "未命名门禁"),
    serial: body.serial,
    password: body.password,
    enabled: body.enabled !== undefined ? !!body.enabled : true,
    locationType,
    gateName: body.gateName || "",
    customLocation: body.customLocation || "",
    building: body.building || "",
    buildingLabel: body.buildingLabel || body.building || "",
    unit: body.unit || "",
    unitLabel: body.unitLabel || body.unit || "",
    sort: Number(body.sort || 0),
    openMethod: body.openMethod || "",
    platform: body.platform || "",
    loginId: body.loginId || "",
    openParams:
      body.openParams && typeof body.openParams === "object"
        ? body.openParams
        : {},
    vendorId: body.vendorId || body.id || "",
    vendorDeviceId: body.vendorDeviceId || "",
    permissionMode:
      body.permissionMode || "all_owners",
    mac: body.mac || "",
    deviceNo: body.deviceNo || "",
    algorithm: body.algorithm !== undefined ? Number(body.algorithm) : 1,
    deviceType: body.deviceType !== undefined ? Number(body.deviceType) : 1,
    sourceid: body.sourceid || "",
    renewalTime: body.renewalTime || null,
    remark: body.remark || null,
  };
}

// 查询小区门禁功能是否已开启
async function getCommunityDoorEnabled(communityId) {
  if (!communityId) return false;
  try {
    const res = await db.collection("communities").doc(communityId).get();
    const community = Array.isArray(res.data) ? res.data[0] : res.data;
    return !!(community && community.doorManagementEnabled === true);
  } catch (e) {
    return false;
  }
}

// 根据角色解析 communityId：超级管理员从 query/body 取，社区管理员从 JWT 取
function resolveCommunityId(user, req) {
  if (user && user.role === "super") {
    return (
      (req.query && req.query.communityId) ||
      (req.body && req.body.communityId) ||
      user.communityId
    );
  }
  return user && user.communityId;
}

router.get("/door/location-options", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const communityId = resolveCommunityId(user, req);
    if (!communityId) {
      return res
        .status(400)
        .json({ success: false, error: "community_id_missing" });
    }

    const configRes = await db
      .collection("house_config")
      .where({
        communityId,
        type: "house",
      })
      .limit(1)
      .get();

    const config =
      configRes.data && configRes.data[0] ? configRes.data[0] : null;
    const buildings = Array.isArray(config && config.buildings)
      ? config.buildings.map((b) => ({
          building: String(pickFirst(b.name, b.building, "") || "").trim(),
          buildingName: String(pickFirst(b.name, b.building, "") || "").trim(),
          units: Array.isArray(b.units)
            ? b.units
                .map((u) => String(pickFirst(u.name, u.unit, "") || "").trim())
                .filter((u) => !!u)
            : [],
        }))
      : [];

    return res.json({
      success: true,
      data: {
        buildings: buildings.filter((b) => !!b.building),
      },
    });
  } catch (error) {
    console.error("/door/location-options error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "door_location_options_error",
    });
  }
});

router.get("/door/devices", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const communityId = resolveCommunityId(user, req);
    if (!communityId) {
      return res
        .status(400)
        .json({ success: false, error: "community_id_missing" });
    }

    // 非超级管理员：门禁功能未开启时返回空列表
    if (user.role !== "super") {
      const enabled = await getCommunityDoorEnabled(communityId);
      if (!enabled) {
        return res.json({ success: true, data: [] });
      }
    }

    const listRes = await db
      .collection("door_devices")
      .where({ communityId })
      .orderBy("sort", "asc")
      .get();

    const list = (listRes.data || []).map((item) => ({
      ...item,
      locationLabel: buildLocationLabel(item),
      unitKey: buildUnitKey(item.building, item.unit),
    }));

    return res.json({ success: true, data: list });
  } catch (error) {
    console.error("/door/devices list error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "door_device_list_error",
    });
  }
});

// ============================================================
// POST /door/devices/register — 添加门禁（调厂商注册 + 存本地 + 大门自动授权）
// ============================================================
router.post("/door/devices/register", superAdminOnly, async (req, res) => {
  try {
    const user = req.user;
    const body = req.body || {};
    const communityId = resolveCommunityId(user, req);
    if (!communityId) {
      return res
        .status(400)
        .json({ success: false, error: "缺少小区ID" });
    }

    const requiredFields = [
      "deviceName", "serial", "password", "deviceNo",
      "mac", "deviceType", "algorithm",
    ];
    const fieldLabels = {
      deviceName: "门禁名称", serial: "设备系列号", password: "设备密码",
      deviceNo: "出厂编号", mac: "MAC地址", deviceType: "设备类型", algorithm: "算法",
    };
    const missing = requiredFields.filter(
      (k) => body[k] === undefined || body[k] === null || body[k] === "",
    );
    if (missing.length) {
      const missingLabels = missing.map((k) => fieldLabels[k] || k).join("、");
      return res.status(400).json({
        success: false,
        error: `缺少必填字段：${missingLabels}`,
      });
    }

    const locationType =
      body.locationType ||
      (buildUnitKey(body.building, body.unit) ? "unit_gate" : "community_gate");

    if (locationType === "unit_gate" && (!body.building || !body.unit)) {
      return res.status(400).json({
        success: false,
        error: "单元门禁必须选择楼栋和单元",
      });
    }

    // 检查 serial 是否已存在
    const existingRes = await db
      .collection("door_devices")
      .where({ communityId, serial: body.serial })
      .limit(1)
      .get();
    if (existingRes.data && existingRes.data.length > 0) {
      return res
        .status(409)
        .json({ success: false, error: "该设备系列号已在当前小区注册，请勿重复添加" });
    }

    // 1. 调厂商 data.device.add
    const fondcardBaseUrl = process.env.FONDCARD_API_BASE_URL || "";
    if (!fondcardBaseUrl) {
      return res.status(500).json({
        success: false,
        error: "fondcard_not_configured",
        detail: "尚未配置 FONDCARD_API_BASE_URL，请在 admin/.env 中设置厂商接口地址",
      });
    }

    let client;
    try {
      client = new FondcardClient();
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "fondcard_client_init_failed",
        detail: err.message,
      });
    }

    const platform = pickFirst(
      body.platform,
      process.env.FONDCARD_DEFAULT_PLATFORM,
      "antai",
    );
    const loginId = pickFirst(
      body.loginId,
      process.env.FONDCARD_DEFAULT_LOGIN_ID,
      "11609",
    );

    let vendorDeviceId = "";
    try {
      const deviceParams = {
        serial: body.serial,
        password: body.password,
        deviceNo: Number(body.deviceNo),
        deviceType: Number(body.deviceType),
        mac: body.mac,
        algorithm: Number(body.algorithm),
        platform,
      };
      // 厂商设备表ID（可选，2.4版本中用于兼容老设备）
      if (body.vendorId) deviceParams.id = body.vendorId;
      if (body.sourceid) deviceParams.sourceid = body.sourceid;
      const addRes = await client.addDevice(deviceParams);
      vendorDeviceId =
        addRes.data && addRes.data.id ? String(addRes.data.id) : "";
    } catch (err) {
      console.error("[door] register fondcard addDevice failed:", err.message);
      const fondcardCode = err.code !== undefined ? Number(err.code) : null;
      return res.status(502).json({
        success: false,
        error: "fondcard_device_add_failed",
        fondcardCode,
        fondcardMessage: err.message || "",
        detail: err.message,
      });
    }

    // 2. 存本地 door_devices
    const now = new Date().toISOString();
    const deviceData = {
      ...sanitizeDevicePayload(body),
      communityId,
      vendorDeviceId,
      platform,
      loginId,
      location: buildLocationLabel(sanitizeDevicePayload(body)),
      createdAt: now,
      updatedAt: now,
      createdBy: user._id || user.username || "",
    };
    const addLocalRes = await db.collection("door_devices").add(deviceData);
    const localDeviceId = addLocalRes.id || addLocalRes._id;

    // 3. 大门门禁 → 所有户主；单元门禁 → 仅该单元户主，openid 直接写入设备文档
    const grantedOwnerIds = [];
    const grantedOwnerOpenids = [];
    try {
      const ownerQuery = { communityId };
      if (locationType === "unit_gate" && body.building && body.unit) {
        ownerQuery.building = body.building;
        ownerQuery.unit = body.unit;
      }
      const ownerListRes = await db
        .collection("owner_list")
        .where(ownerQuery)
        .limit(500)
        .get();
      for (const owner of ownerListRes.data || []) {
        grantedOwnerIds.push(owner._id);
        if (owner.openid) grantedOwnerOpenids.push(owner.openid);
      }
      // 更新设备文档，写入授权 openid 数组
      await db.collection("door_devices").doc(localDeviceId).update({
        grantedOwnerIds,
        grantedOwnerOpenids,
        updatedAt: now,
      });
    } catch (permErr) {
      console.error("[door] register auto-permission error:", permErr.message);
    }

    return res.json({
      success: true,
      data: { _id: localDeviceId, vendorDeviceId, created: true },
    });
  } catch (error) {
    console.error("/door/devices/register error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "door_device_register_error",
    });
  }
});

router.post("/door/devices", superAdminOnly, async (req, res) => {
  try {
    const user = req.user;
    const communityId = resolveCommunityId(user, req);
    if (!communityId) {
      return res
        .status(400)
        .json({ success: false, error: "community_id_missing" });
    }

    const payload = sanitizeDevicePayload(req.body || {});
    if (!payload.serial || !payload.password) {
      return res.status(400).json({
        success: false,
        error: "missing_required_fields",
        missing: ["serial", "password"],
      });
    }

    if (
      payload.locationType === "unit_gate" &&
      !buildUnitKey(payload.building, payload.unit)
    ) {
      return res.status(400).json({
        success: false,
        error: "unit_gate_requires_building_and_unit",
      });
    }

    const now = new Date().toISOString();
    const existingRes = await db
      .collection("door_devices")
      .where({
        communityId,
        serial: payload.serial,
      })
      .limit(1)
      .get();

    const data = {
      ...payload,
      communityId,
      location: buildLocationLabel(payload),
      updatedAt: now,
    };

    let deviceId;
    let isUpdate = false;
    if (existingRes.data && existingRes.data.length > 0) {
      deviceId = existingRes.data[0]._id;
      await db.collection("door_devices").doc(deviceId).update(data);
      isUpdate = true;
    } else {
      data.createdAt = now;
      const addRes = await db.collection("door_devices").add(data);
      deviceId = addRes.id || addRes._id;
    }

    // Phase 6: 对已有门禁权限的认证主人补绑 Key
    if (!isUpdate) {
      const savedDevice = { ...data, _id: deviceId };
      const unitKey = buildUnitKey(payload.building, payload.unit);
      const certsFilter = { communityId, doorAccessEnabled: true };
      const certsRes = await db
        .collection("certification_applications")
        .where(certsFilter)
        .get();
      const certs = certsRes.data || [];
      for (const cert of certs) {
        const applicable =
          payload.locationType === "community_gate" ||
          (payload.locationType === "unit_gate" &&
            unitKey &&
            buildUnitKey(cert.building, cert.unit) === unitKey);
        if (applicable) {
          addKeyToNewDevice(cert, savedDevice).catch((err) =>
            console.error(
              `[door] addKeyToNewDevice failed for cert ${cert._id}:`,
              err.message,
            ),
          );
        }
      }
    }

    return res.json({
      success: true,
      data: { _id: deviceId, [isUpdate ? "updated" : "created"]: true },
    });
  } catch (error) {
    console.error("/door/devices create error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "door_device_create_error",
    });
  }
});

router.put("/door/devices/:id", superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "missing_device_id" });
    }

    const currentRes = await db.collection("door_devices").doc(id).get();
    let current = currentRes && currentRes.data ? currentRes.data : null;
    if (Array.isArray(current)) {
      current = current[0] || null;
    }
    if (!current) {
      return res
        .status(404)
        .json({ success: false, error: "device_not_found" });
    }

    const incoming = req.body || {};
    const mergedRaw = {
      ...current,
      ...incoming,
      serial: pickFirst(incoming.serial, current.serial),
      password: pickFirst(incoming.password, current.password),
      openParams:
        incoming.openParams && typeof incoming.openParams === "object"
          ? incoming.openParams
          : current.openParams || {},
    };
    const payload = sanitizeDevicePayload(mergedRaw);

    if (!payload.serial || !payload.password) {
      return res.status(400).json({
        success: false,
        error: "missing_required_fields",
        missing: ["serial", "password"],
      });
    }

    if (
      payload.locationType === "unit_gate" &&
      !buildUnitKey(payload.building, payload.unit)
    ) {
      return res.status(400).json({
        success: false,
        error: "unit_gate_requires_building_and_unit",
      });
    }

    await db
      .collection("door_devices")
      .doc(id)
      .update({
        ...payload,
        communityId: current.communityId,
        location: buildLocationLabel(payload),
        updatedAt: new Date().toISOString(),
      });

    return res.json({ success: true, data: { _id: id, updated: true } });
  } catch (error) {
    console.error("/door/devices update error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "door_device_update_error",
    });
  }
});

router.delete("/door/devices/:id", superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "missing_device_id" });
    }

    const currentRes = await db.collection("door_devices").doc(id).get();
    let current = currentRes && currentRes.data ? currentRes.data : null;
    if (Array.isArray(current)) {
      current = current[0] || null;
    }
    if (!current) {
      return res
        .status(404)
        .json({ success: false, error: "device_not_found" });
    }

    // 删除厂商侧设备（失败只记日志，不阻断本地删除）
    if (current.serial && current.password) {
      const client = new FondcardClient();
      try {
        await client.deleteDevice({
          serial: current.serial,
          password: current.password,
        });
      } catch (err) {
        console.error(
          `[door] delete vendor device failed for ${id}:`,
          err.message,
        );
      }
      // 同时解绑 login 下的设备
      const loginId = pickFirst(
        current.loginId,
        process.env.FONDCARD_DEFAULT_LOGIN_ID,
        "11609",
      );
      try {
        await client.deleteLoginDevice({
          loginId,
          password: current.password,
          serial: current.serial,
        });
      } catch (err) {
        console.error(
          `[door] deleteLoginDevice failed for ${id}:`,
          err.message,
        );
      }
    }

    await db.collection("door_devices").doc(id).remove();
    return res.json({ success: true, data: { _id: id, deleted: true } });
  } catch (error) {
    console.error("/door/devices delete error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "door_device_delete_error",
    });
  }
});

// ==== 主人门禁权限管理接口 ====

const {
  grantDoorAccess,
  revokeDoorAccess,
} = require("../utils/door-permissions");

/**
 * GET /door/owner-permissions
 * 获取小区认证主人列表及门禁权限状态
 * query: communityId (超级管理员可指定)
 */
router.get("/door/owner-permissions", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const communityId = resolveCommunityId(user, req);
    if (!communityId) {
      return res
        .status(400)
        .json({ success: false, error: "community_id_missing" });
    }

    // 非超级管理员需检测门禁功能开启状态
    if (user.role !== "super") {
      const enabled = await getCommunityDoorEnabled(communityId);
      if (!enabled) {
        return res.json({ success: true, data: [] });
      }
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
      Math.max(1, parseInt(req.query.pageSize) || 50),
      500,
    );

    const baseQuery = db
      .collection("certification_applications")
      .where({ communityId, status: "approved" });

    const countRes = await baseQuery.count();
    const total = countRes.total || 0;

    const certsRes = await baseQuery
      .orderBy("createdAt", "desc")
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const data = (certsRes.data || []).map((cert) => ({
      _id: cert._id,
      openid: cert.openid,
      name: cert.name || "",
      phone: cert.phone || "",
      building: cert.building || "",
      unit: cert.unit || "",
      room: cert.room || "",
      communityId: cert.communityId,
      doorAccessEnabled: cert.doorAccessEnabled === true,
      fondcardId: cert.fondcardId || null,
      createdAt: cert.createdAt,
      updatedAt: cert.updatedAt,
    }));

    return res.json({ success: true, data, total, page, pageSize });
  } catch (error) {
    console.error("/door/owner-permissions list error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "list_error" });
  }
});

/**
 * POST /door/owner-permissions/batch-enable
 * 批量开通门禁权限（5并发分批）
 * body: { certIds: string[] }
 */
router.post(
  "/door/owner-permissions/batch-enable",
  authMiddleware,
  async (req, res) => {
    try {
      const user = req.user;
      const { certIds } = req.body || {};
      if (!Array.isArray(certIds) || certIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "certIds_required" });
      }
      if (certIds.length > 100) {
        return res.status(400).json({ success: false, error: "max_100_ids" });
      }

      const succeeded = [];
      const failed = [];
      const chunks = chunkArray(certIds, 5);

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(async (certId) => {
            const certRes = await db
              .collection("certification_applications")
              .doc(certId)
              .get();
            let cert = certRes && certRes.data ? certRes.data : null;
            if (Array.isArray(cert)) cert = cert[0] || null;
            if (!cert || cert.status !== "approved") {
              throw new Error("cert_not_found_or_not_approved");
            }
            if (
              user.role !== "super" &&
              cert.communityId !== user.communityId
            ) {
              throw new Error("forbidden");
            }
            if (!cert.doorAccessEnabled) {
              await grantDoorAccess(cert, cert.communityId);
            }
            return certId;
          }),
        );
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === "fulfilled") {
            succeeded.push(chunk[i]);
          } else {
            failed.push({
              id: chunk[i],
              error: results[i].reason?.message || "unknown_error",
            });
          }
        }
      }

      return res.json({ success: true, data: { succeeded, failed } });
    } catch (error) {
      console.error("/door/owner-permissions batch-enable error:", error);
      return res
        .status(500)
        .json({ success: false, error: error.message || "batch_enable_error" });
    }
  },
);

/**
 * POST /door/owner-permissions/batch-disable
 * 批量封禁门禁权限（5并发分批）
 * body: { certIds: string[] }
 */
router.post(
  "/door/owner-permissions/batch-disable",
  authMiddleware,
  async (req, res) => {
    try {
      const user = req.user;
      const { certIds } = req.body || {};
      if (!Array.isArray(certIds) || certIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "certIds_required" });
      }
      if (certIds.length > 100) {
        return res.status(400).json({ success: false, error: "max_100_ids" });
      }

      const succeeded = [];
      const failed = [];
      const chunks = chunkArray(certIds, 5);

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(async (certId) => {
            const certRes = await db
              .collection("certification_applications")
              .doc(certId)
              .get();
            let cert = certRes && certRes.data ? certRes.data : null;
            if (Array.isArray(cert)) cert = cert[0] || null;
            if (!cert) throw new Error("cert_not_found");
            if (
              user.role !== "super" &&
              cert.communityId !== user.communityId
            ) {
              throw new Error("forbidden");
            }
            if (cert.doorAccessEnabled) {
              await revokeDoorAccess(cert);
            }
            return certId;
          }),
        );
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === "fulfilled") {
            succeeded.push(chunk[i]);
          } else {
            failed.push({
              id: chunk[i],
              error: results[i].reason?.message || "unknown_error",
            });
          }
        }
      }

      return res.json({ success: true, data: { succeeded, failed } });
    } catch (error) {
      console.error("/door/owner-permissions batch-disable error:", error);
      return res
        .status(500)
        .json({
          success: false,
          error: error.message || "batch_disable_error",
        });
    }
  },
);

/**
 * POST /door/owner-permissions/:certId/enable
 * 为主人开通门禁权限
 */
router.post(
  "/door/owner-permissions/:certId/enable",
  authMiddleware,
  async (req, res) => {
    try {
      const user = req.user;
      const { certId } = req.params;

      const certRes = await db
        .collection("certification_applications")
        .doc(certId)
        .get();
      let cert = certRes && certRes.data ? certRes.data : null;
      if (Array.isArray(cert)) cert = cert[0] || null;
      if (!cert || cert.status !== "approved") {
        return res
          .status(404)
          .json({ success: false, error: "cert_not_found_or_not_approved" });
      }

      // 权限检查：社区管理员只能操作自山区
      if (user.role !== "super" && cert.communityId !== user.communityId) {
        return res.status(403).json({ success: false, error: "forbidden" });
      }

      if (cert.doorAccessEnabled) {
        return res.json({ success: true, message: "already_enabled" });
      }

      await grantDoorAccess(cert, cert.communityId);
      return res.json({ success: true, message: "door_access_granted" });
    } catch (error) {
      console.error("/door/owner-permissions enable error:", error);
      return res
        .status(500)
        .json({ success: false, error: error.message || "enable_error" });
    }
  },
);

/**
 * POST /door/owner-permissions/:certId/disable
 * 封禁主人门禁权限
 */
router.post(
  "/door/owner-permissions/:certId/disable",
  authMiddleware,
  async (req, res) => {
    try {
      const user = req.user;
      const { certId } = req.params;

      const certRes = await db
        .collection("certification_applications")
        .doc(certId)
        .get();
      let cert = certRes && certRes.data ? certRes.data : null;
      if (Array.isArray(cert)) cert = cert[0] || null;
      if (!cert) {
        return res
          .status(404)
          .json({ success: false, error: "cert_not_found" });
      }

      if (user.role !== "super" && cert.communityId !== user.communityId) {
        return res.status(403).json({ success: false, error: "forbidden" });
      }

      if (!cert.doorAccessEnabled) {
        return res.json({ success: true, message: "already_disabled" });
      }

      await revokeDoorAccess(cert);
      return res.json({ success: true, message: "door_access_revoked" });
    } catch (error) {
      console.error("/door/owner-permissions disable error:", error);
      return res
        .status(500)
        .json({ success: false, error: error.message || "disable_error" });
    }
  },
);

function buildOpenParams({
  device,
  serial,
  openid,
  communityId,
  requestId,
  source,
}) {
  const now = Math.floor(Date.now() / 1000);
  const base =
    device && typeof device.openParams === "object" && device.openParams
      ? { ...device.openParams }
      : {};

  const loginId = pickFirst(
    base.loginId,
    device.loginId,
    process.env.FONDCARD_OPEN_LOGIN_ID,
  );

  const password = pickFirst(
    base.password,
    base.devicePassword,
    device.password,
    device.devicePassword,
  );

  return {
    ...base,
    serial,
    password,
    platform: pickFirst(
      base.platform,
      device.platform,
      process.env.FONDCARD_OPEN_PLATFORM,
    ),
    loginId,
    userId: pickFirst(base.userId, loginId),
    openid,
    communityId,
    requestId,
    source,
    timestamp: now,
  };
}

async function openDoorViaFondcard({
  device,
  serial,
  openid,
  communityId,
  requestId,
  source,
}) {
  const method = pickFirst(device.openMethod, process.env.FONDCARD_OPEN_METHOD);
  if (!method) {
    throw new Error("fondcard_open_method_missing");
  }

  const client = new FondcardClient();
  const params = buildOpenParams({
    device,
    serial,
    openid,
    communityId,
    requestId,
    source,
  });

  if (!params.password) {
    throw new Error("fondcard_open_password_missing_in_device");
  }

  const result = await client.call(method, params);
  return {
    method,
    result,
    request: {
      serial,
      platform: params.platform,
      loginId: params.loginId,
      userId: params.userId,
    },
  };
}

router.post("/door/open-from-cloud", async (req, res) => {
  try {
    const accessKey = req.header("x-cloud-access-key") || "";
    if (
      !process.env.DOOR_CLOUD_ACCESS_KEY ||
      accessKey !== process.env.DOOR_CLOUD_ACCESS_KEY
    ) {
      return res
        .status(401)
        .json({ success: false, error: "invalid_cloud_access_key" });
    }

    const {
      openid,
      serial,
      communityId,
      requestId,
      source = "mini-program",
    } = req.body || {};

    if (!openid || !serial || !communityId || !requestId) {
      return res
        .status(400)
        .json({ success: false, error: "missing_required_fields" });
    }

    const deviceRes = await db
      .collection("door_devices")
      .where({
        serial,
        communityId,
        enabled: true,
      })
      .limit(1)
      .get();

    if (!deviceRes.data || deviceRes.data.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "device_not_found" });
    }

    const device = deviceRes.data[0];

    // 权限校验：specified_owners 模式下仅白名单用户可开
    if (device.permissionMode === "specified_owners") {
      const granted = device.grantedOwnerOpenids || [];
      // 家属继承户主权限：查找家属关联的户主openid
      let effectiveOpenid = openid;
      if (!granted.includes(openid)) {
        const familyCert = await db
          .collection("certification_applications")
          .where({ openid, communityId, type: "family", status: "approved" })
          .limit(1)
          .get();
        if (familyCert.data && familyCert.data.length > 0) {
          const ownerOpenid = familyCert.data[0].ownerOpenid;
          if (ownerOpenid && granted.includes(ownerOpenid)) {
            effectiveOpenid = ownerOpenid;
          }
        }
      }
      if (!granted.includes(openid) && !(effectiveOpenid !== openid && granted.includes(effectiveOpenid))) {
        return res.status(403).json({ success: false, error: "NO_DOOR_PERMISSION", message: "该用户无此设备的开门权限" });
      }
    }

    // 未在厂商侧注册的用户自动注册
    const existingGranted = device.grantedOwnerOpenids || [];
    if (!existingGranted.includes(openid)) {
      try {
        const cert = await db
          .collection("certification_applications")
          .where({ openid, communityId, status: "approved" })
          .limit(1)
          .get();
        if (cert.data && cert.data.length > 0) {
          const user = cert.data[0];
          const keyId = Math.random().toString(16).slice(2, 10);
          const now = Math.floor(Date.now() / 1000);
          const keyDate = Math.floor((Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) / 1000);

          const client = new FondcardClient({
            platform: device.platform || process.env.FONDCARD_DEFAULT_PLATFORM,
            loginId: device.loginId || process.env.FONDCARD_DEFAULT_LOGIN_ID,
          });

          await client.addKey({
            serial: device.serial,
            password: device.password,
            keyType: 1,
            keyId,
            keyCount: 1,
            startDate: now,
            keyDate,
            periodNo: 0,
          });

          try {
            await client.mqttKeyUpdate({ serial: device.serial, password: device.password, userId: device.loginId || process.env.FONDCARD_DEFAULT_LOGIN_ID });
          } catch (_) {}

          // 更新设备白名单
          const updatedOpenids = [...new Set([...existingGranted, openid])];
          await db.collection("door_devices").doc(device._id).update({
            grantedOwnerOpenids: updatedOpenids,
            updatedAt: new Date(),
          });

          console.log(`[open-from-cloud] 已自动注册用户 ${openid} 到设备 ${serial}`);
        }
      } catch (regErr) {
        console.warn(`[open-from-cloud] 自动注册用户 ${openid} 失败:`, regErr.message);
      }
    }

    const openRes = await openDoorViaFondcard({
      device,
      serial,
      openid,
      communityId,
      requestId,
      source,
    });

    // 开门日志异步写入：不阻塞开门响应，缓解并发下的 DB 写压力；
    // 注意 @cloudbase/node-sdk 的 add 直接收文档对象（不带 { data } 包装）
    db.collection("door_open_logs")
      .add({
        openid,
        serial,
        communityId,
        requestId,
        source,
        status: "sent",
        execution: "fondcard_http",
        method: openRes.method,
        requestMeta: openRes.request,
        resultCode:
          openRes.result && openRes.result.code !== undefined
            ? Number(openRes.result.code)
            : null,
        resultMessage: openRes.result ? openRes.result.message : null,
        rawResult: openRes.result || null,
        createdAt: new Date(),
      })
      .catch((logError) => {
        console.error("door_open_logs add failed:", logError);
      });

    return res.json({
      success: true,
      data: {
        method: openRes.method,
        result: openRes.result,
        logPersisted: true,
      },
      message: "开门HTTP请求已提交",
    });
  } catch (error) {
    console.error("/door/open-from-cloud error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "door_open_http_error",
    });
  }
});

// ============================================================
// 2a. GET /door/communities — 已开通门禁的小区列表
// ============================================================
router.get("/door/communities", superAdminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
      Math.max(1, parseInt(req.query.pageSize) || 20),
      200,
    );
    const name = (req.query.name || "").trim();

    const baseQuery = db
      .collection("communities")
      .where({ doorManagementEnabled: true });

    const countRes = await baseQuery.count();
    const total = countRes.total || 0;

    let query = baseQuery.orderBy("createdAt", "desc");
    if (name) {
      query = baseQuery
        .where({
          doorManagementEnabled: true,
          name: db.RegExp({
            regexp: name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            options: "i",
          }),
        })
        .orderBy("createdAt", "desc");
      const nameCountRes = await db
        .collection("communities")
        .where({
          doorManagementEnabled: true,
          name: db.RegExp({
            regexp: name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            options: "i",
          }),
        })
        .count();
      const nameTotal = nameCountRes.total || 0;
      const listRes = await query
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();
      return res.json({
        success: true,
        data: listRes.data || [],
        total: nameTotal,
        page,
        pageSize,
      });
    }

    const listRes = await query
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return res.json({
      success: true,
      data: listRes.data || [],
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("/door/communities error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "door_communities_error",
    });
  }
});

/**
 * PUT /api/door/communities/:id — 编辑小区的续费时间和备注
 */
router.put("/door/communities/:id", superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { renewalTime, remark } = req.body;
    const updateData = { updatedAt: new Date() };

    if (renewalTime !== undefined) updateData.renewalTime = renewalTime;
    if (remark !== undefined) updateData.remark = remark;

    await db.collection("communities").doc(id).update(updateData);
    return res.json({ success: true });
  } catch (error) {
    console.error("PUT /door/communities/:id error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "更新失败",
    });
  }
});

// ============================================================
// 2b. POST /door/devices/batch-delete — 批量删除设备
// ============================================================
router.post("/door/devices/batch-delete", superAdminOnly, async (req, res) => {
  try {
    const { deviceIds } = req.body || {};
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "deviceIds_required" });
    }
    if (deviceIds.length > 50) {
      return res
        .status(400)
        .json({ success: false, error: "max_50_devices" });
    }

    const succeeded = [];
    const failed = [];

    for (const deviceId of deviceIds) {
      try {
        const devRes = await db
          .collection("door_devices")
          .doc(deviceId)
          .get();
        let device = devRes && devRes.data ? devRes.data : null;
        if (Array.isArray(device)) device = device[0] || null;
        if (!device) {
          failed.push({ id: deviceId, error: "device_not_found" });
          continue;
        }

        // 删除厂商侧设备
        if (device.serial && device.password) {
          const client = new FondcardClient();
          try {
            await client.deleteDevice({
              serial: device.serial,
              password: device.password,
            });
          } catch (err) {
            console.error(
              `[door] batch-delete vendor device failed for ${deviceId}:`,
              err.message,
            );
          }
          // 解绑 login 下的设备
          const loginId = pickFirst(
            device.loginId,
            process.env.FONDCARD_DEFAULT_LOGIN_ID,
            "11609",
          );
          try {
            await client.deleteLoginDevice({
              loginId,
              password: device.password,
              serial: device.serial,
            });
          } catch (err) {
            console.error(
              `[door] batch-delete deleteLoginDevice failed for ${deviceId}:`,
              err.message,
            );
          }
        }

        await db.collection("door_devices").doc(deviceId).remove();
        succeeded.push(deviceId);
      } catch (err) {
        console.error(`[door] batch-delete error for ${deviceId}:`, err);
        failed.push({ id: deviceId, error: err.message || "delete_error" });
      }
    }

    return res.json({ success: true, data: { succeeded, failed } });
  } catch (error) {
    console.error("/door/devices/batch-delete error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "batch_delete_error",
    });
  }
});

// ============================================================
// 2c. PATCH /door/devices/:id/toggle — 禁用/启用设备
// ============================================================
router.patch("/door/devices/:id/toggle", superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "missing_device_id" });
    }

    const { enabled } = req.body || {};
    if (enabled === undefined || enabled === null) {
      return res
        .status(400)
        .json({ success: false, error: "enabled_field_required" });
    }

    const currentRes = await db.collection("door_devices").doc(id).get();
    let current = currentRes && currentRes.data ? currentRes.data : null;
    if (Array.isArray(current)) current = current[0] || null;
    if (!current) {
      return res
        .status(404)
        .json({ success: false, error: "device_not_found" });
    }

    await db
      .collection("door_devices")
      .doc(id)
      .update({
        enabled: !!enabled,
        updatedAt: new Date().toISOString(),
      });

    return res.json({ success: true, data: { _id: id, enabled: !!enabled } });
  } catch (error) {
    console.error("/door/devices/:id/toggle error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "device_toggle_error",
    });
  }
});

// ============================================================
// 2d. GET /door/device/:deviceId/owner-list — 户主列表（权限配置弹窗）
// ============================================================
router.get(
  "/door/device/:deviceId/owner-list",
  authMiddleware,
  async (req, res) => {
    try {
      const user = req.user;
      const { deviceId } = req.params;
      const communityId = resolveCommunityId(user, req);
      if (!communityId) {
        return res
          .status(400)
          .json({ success: false, error: "community_id_missing" });
      }

      // 验证设备存在
      const devRes = await db
        .collection("door_devices")
        .doc(deviceId)
        .get();
      let device = devRes && devRes.data ? devRes.data : null;
      if (Array.isArray(device)) device = device[0] || null;
      if (!device) {
        return res
          .status(404)
          .json({ success: false, error: "device_not_found" });
      }

      const page = Math.max(1, parseInt(req.query.page) || 1);
      const pageSize = Math.min(
        Math.max(1, parseInt(req.query.pageSize) || 20),
        200,
      );
      const search = (req.query.search || "").trim();
      const building = (req.query.building || "").trim();
      const unit = (req.query.unit || "").trim();

      // 户主数据源：优先 owner_list，若为空则回退 certification_applications
      const useOwnerList = async () => {
        const ck = await db.collection("owner_list").where({ communityId }).limit(1).get();
        return !!(ck.data && ck.data.length > 0);
      };
      const isOwnerList = await useOwnerList();
      const ownerColl = isOwnerList ? "owner_list" : "certification_applications";

      // 查询方法：根据 search 决定合并方式
      const queryOwners = async (collName, filter, pg, ps) => {
        if (search) {
          const nameCond = { ...filter, name: search };
          const phoneCond = { ...filter, phone: search };
          if (collName === "certification_applications") {
            nameCond.status = "approved";
            phoneCond.status = "approved";
          }
          const [byName, byPhone] = await Promise.all([
            db.collection(collName).where(nameCond).get(),
            db.collection(collName).where(phoneCond).get(),
          ]);
          const seen = new Set();
          const merged = [];
          for (const item of [...(byName.data || []), ...(byPhone.data || [])]) {
            if (!seen.has(item._id)) { seen.add(item._id); merged.push(item); }
          }
          const start = (pg - 1) * ps;
          return { owners: merged.slice(start, start + ps), total: merged.length };
        }
        const count = await db.collection(collName).where(filter).count();
        const list = await db.collection(collName).where(filter)
          .orderBy("building", "asc").skip((pg - 1) * ps).limit(ps).get();
        return { owners: list.data || [], total: count.total || 0 };
      };

      const filter = { communityId };
      if (building) filter.building = building;
      if (unit) filter.unit = unit;
      if (!isOwnerList) filter.status = "approved";

      const { owners, total } = await queryOwners(ownerColl, filter, page, pageSize);

      // 权限直接从设备文档的 grantedOwnerIds / grantedOwnerOpenids 读取
      const grantedIds = device.grantedOwnerIds || [];
      const grantedOpenids = device.grantedOwnerOpenids || [];
      const idSet = new Set(grantedIds.map(String));
      const openidSet = new Set(grantedOpenids.map(String));

      const data = owners.map((o) => ({
        _id: o._id,
        openid: o.openid || "",
        name: o.name || "",
        phone: o.phone || "",
        building: o.building || "",
        unit: o.unit || "",
        room: o.room || "",
        hasPermission: idSet.has(String(o._id)) || openidSet.has(String(o.openid || "")),
      }));

      return res.json({
        success: true,
        data,
        total,
        page,
        pageSize,
        grantedOwnerIds: grantedIds,
        grantedOwnerOpenids: grantedOpenids,
      });
    } catch (error) {
      console.error("/door/device/:deviceId/owner-list error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "owner_list_error",
      });
    }
  },
);

// ============================================================
// 2e. POST /door/device/:deviceId/grant-permissions — 批量授权
// ============================================================
router.post(
  "/door/device/:deviceId/grant-permissions",
  authMiddleware,
  async (req, res) => {
    try {
      const user = req.user;
      const { deviceId } = req.params;
      const { communityId } = req.body || {};
      const rawItems = req.body.items || [];
      const ownerIds = req.body.ownerIds || [];
      const items = rawItems.length > 0 ? rawItems : ownerIds.map((id) => ({ ownerId: id, openid: "" }));
      if (!communityId) return res.status(400).json({ success: false, error: "communityId_required" });
      if (user && user.role !== "super" && user.communityId !== communityId) return res.status(403).json({ success: false, error: "forbidden" });
      if (items.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "ownerIds_required" });
      }
      if (items.length > 200) {
        return res
          .status(400)
          .json({ success: false, error: "max_200_owners" });
      }

      // 1. 查设备信息
      const devRes = await db
        .collection("door_devices")
        .doc(deviceId)
        .get();
      let device = devRes && devRes.data ? devRes.data : null;
      if (Array.isArray(device)) device = device[0] || null;
      if (!device) {
        return res
          .status(404)
          .json({ success: false, error: "device_not_found" });
      }

      if (!device.serial || !device.password) {
        return res.status(400).json({
          success: false,
          error: "device_missing_serial_or_password",
        });
      }


      const platform =
        pickFirst(
          device.platform,
          process.env.FONDCARD_DEFAULT_PLATFORM,
          "antai",
        );
      const loginId = pickFirst(
        device.loginId,
        process.env.FONDCARD_DEFAULT_LOGIN_ID,
        "11609",
      );

      const client = new FondcardClient();

      const succeeded = [];
      const failed = [];
      // 5 并发分批
      const chunks = chunkArray(items, 5);

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(async (item) => {
            const ownerId = item.ownerId;
            const inputOpenid = item.openid || "";
            let owner = null;
            let cert = null;
            let ownerOpenid = inputOpenid;
            try {
              const ownerRes = await db.collection("owner_list").doc(ownerId).get();
              owner = ownerRes && ownerRes.data ? ownerRes.data : null;
              if (Array.isArray(owner)) owner = owner[0] || null;
            } catch (_) {}
            // 没在 owner_list 找到，试 certification_applications
            if (!owner) {
              try {
                const cr = await db.collection("certification_applications").doc(ownerId).get();
                cert = cr && cr.data ? cr.data : null;
                if (Array.isArray(cert)) cert = cert[0] || null;
                if (cert && cert.status === "approved") {
                  ownerOpenid = cert.openid || "";
                } else {
                  cert = null;
                }
              } catch (_) {}
            }
            if (!owner && !cert) throw new Error("owner_not_found");

            if (owner) {
              ownerOpenid = owner.openid || ownerOpenid;
              // 3. 查找或创建 fondcardId
              try {
                const certRes = await db.collection("certification_applications")
                  .where({ communityId, building: owner.building || "", unit: owner.unit || "", room: owner.room || "", status: "approved" })
                  .limit(1).get();
                cert = certRes.data && certRes.data[0] ? certRes.data[0] : cert;
              } catch (_) {}
              // 回退：按 openid 查
              if (!cert && ownerOpenid) {
                try {
                  const cr2 = await db.collection("certification_applications")
                    .where({ communityId, openid: ownerOpenid, status: "approved" }).limit(1).get();
                  cert = cr2.data && cr2.data[0] ? cr2.data[0] : null;
                } catch (_) {}
              }
              if (cert) ownerOpenid = cert.openid || ownerOpenid;
            }

            let fondcardId = cert && cert.fondcardId;
            if (!fondcardId) {
              // 创建 Fondcard 用户
              const userRes = await client.addUser({ platform });
              const userData = userRes && userRes.data;
              fondcardId = userData && userData.id;
              const fondcardSerial = userData && userData.serial;
              const fondcardUserPassword = userData && userData.password;

              if (!fondcardId || !fondcardSerial || !fondcardUserPassword) {
                throw new Error("fondcard_user_add_failed_incomplete_response");
              }

              if (cert) {
                await db
                  .collection("certification_applications")
                  .doc(cert._id)
                  .update({
                    fondcardId: String(fondcardId),
                    fondcardSerial,
                    fondcardUserPassword,
                    doorAccessEnabled: true,
                    updatedAt: new Date().toISOString(),
                  });
              }
            }

            const keyId = toHex8(Number(fondcardId));
            if (!keyId) throw new Error("fondcard_keyhex_invalid");

            return { ownerId, fondcardId: String(fondcardId), keyId, owner, realOpenid: ownerOpenid };
          }),
        );

        // 收集成功的 keyId 和 owner 信息
        const batchKeyIds = [];
        const grantedOwners = [];
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === "fulfilled") {
            const { ownerId, keyId, owner, realOpenid } = results[i].value;
            batchKeyIds.push(keyId);
            grantedOwners.push({ ownerId, keyId, owner, realOpenid });
          } else {
            const failOwnerId = chunk[i] && chunk[i].ownerId ? chunk[i].ownerId : chunk[i];
            failed.push({
              id: failOwnerId,
              error: results[i].reason?.message || "unknown_error",
            });
          }
        }

        if (batchKeyIds.length > 0) {
          try {
            // 4. 批量 data.key.add（keyCount 上限 50）
            const keyIdStr = batchKeyIds.join(",");
            const now = Math.floor(Date.now() / 1000);
            const defaultKeyDate = Math.floor(
              (Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) / 1000,
            );
            const keyDate =
              (device.openParams && device.openParams.keyDate) ||
              defaultKeyDate;
            const startDate =
              (device.openParams && device.openParams.startDate) || now;
            const periodNo =
              device.openParams && device.openParams.periodNo !== undefined
                ? device.openParams.periodNo
                : 0;

            await client.addKey({
              serial: device.serial,
              password: device.password,
              keyType: 1,
              keyId: keyIdStr,
              keyCount: batchKeyIds.length,
              startDate,
              keyDate,
              periodNo,
            });

            // 5. mqtt.key.update 推送（非阻塞，失败不中断）
            try {
              await client.mqttKeyUpdate({ serial: device.serial, password: device.password, userId: loginId });
            } catch (e) {
            }

            // 6. 合并 openid 写回设备文档 grantedOwnerOpenids 数组
            const nowISO = new Date().toISOString();
            const newOpenids = grantedOwners.map((g) => g.realOpenid || (g.owner && g.owner.openid) || "").filter(Boolean);
            const newOwnerIds = grantedOwners.map((g) => g.ownerId);
            // 拉取当前数组，去重合并后写回（避免 db.command.push 兼容问题）
            const currentDev = await db.collection("door_devices").doc(deviceId).get();
            let devData = currentDev && currentDev.data ? currentDev.data : null;
            if (Array.isArray(devData)) devData = devData[0] || null;
            const existingIds = devData ? (devData.grantedOwnerIds || []) : [];
            const existingOpenids = devData ? (devData.grantedOwnerOpenids || []) : [];
            const mergedIds = [...new Set([...existingIds, ...newOwnerIds])];
            const mergedOpenids = [...new Set([...existingOpenids, ...newOpenids])];
            await db.collection("door_devices").doc(deviceId).update({
              grantedOwnerIds: mergedIds,
              grantedOwnerOpenids: mergedOpenids,
              updatedAt: nowISO,
            });

            succeeded.push(...grantedOwners.map((g) => g.ownerId));
          } catch (err) {
            console.error(
              `[door] grant-permissions batch key.add failed:`,
              err.message,
            );
            for (const g of grantedOwners) {
              failed.push({ id: g.ownerId, error: err.message || "key_add_error" });
            }
          }
        }
      }

      // 7. 更新设备 permissionMode
      await db
        .collection("door_devices")
        .doc(deviceId)
        .update({
          permissionMode: "specified_owners",
          updatedAt: new Date().toISOString(),
        });

      return res.json({ success: true, data: { succeeded, failed } });
    } catch (error) {
      console.error("/door/device/:deviceId/grant-permissions error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "grant_permissions_error",
      });
    }
  },
);

// ============================================================
// 2f. POST /door/device/:deviceId/revoke-permissions — 批量撤销权限
// ============================================================
router.post(
  "/door/device/:deviceId/revoke-permissions",
  authMiddleware,
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { communityId, ownerIds } = req.body || {};

      if (!communityId) {
        return res
          .status(400)
          .json({ success: false, error: "communityId_required" });
      }
      if (!Array.isArray(ownerIds) || ownerIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "ownerIds_required" });
      }
      if (ownerIds.length > 200) {
        return res
          .status(400)
          .json({ success: false, error: "max_200_owners" });
      }

      // 查设备信息
      const devRes = await db
        .collection("door_devices")
        .doc(deviceId)
        .get();
      let device = devRes && devRes.data ? devRes.data : null;
      if (Array.isArray(device)) device = device[0] || null;
      if (!device) {
        return res
          .status(404)
          .json({ success: false, error: "device_not_found" });
      }

      if (!device.serial || !device.password) {
        return res.status(400).json({
          success: false,
          error: "device_missing_serial_or_password",
        });
      }

      const client = new FondcardClient();
      const succeeded = [];
      const failed = [];
      const chunks = chunkArray(ownerIds, 5);

      // 批量移除：收集全部待处理的 openid/ownerId，最后统一写回一次
      const allRemoveOwnerIds = [];
      const allRemoveOpenids = [];

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(async (ownerId) => {
            let owner = null;
            let cert = null;
            let ownerOpenid = "";
            try { owner = (await db.collection("owner_list").doc(ownerId).get()).data; } catch (_) {}
            if (Array.isArray(owner)) owner = owner[0] || null;
            if (owner) {
              ownerOpenid = owner.openid || "";
              try {
                // 按 building/unit/room 查 cert
                let cr = await db.collection("certification_applications")
                  .where({ communityId, building: owner.building || "", unit: owner.unit || "", room: owner.room || "", status: "approved" })
                  .limit(1).get();
                cert = cr.data && cr.data[0] ? cr.data[0] : null;
                // 回退：按 openid 查
                if (!cert && ownerOpenid) {
                  cr = await db.collection("certification_applications")
                    .where({ communityId, openid: ownerOpenid, status: "approved" })
                    .limit(1).get();
                  cert = cr.data && cr.data[0] ? cr.data[0] : null;
                }
              } catch (_) {}
              if (cert) ownerOpenid = cert.openid || ownerOpenid;
            }

            // 有 cert 则删除厂商侧 key
            if (cert && cert.fondcardId) {
              const keyId = toHex8(Number(cert.fondcardId));
              if (keyId) {
                try {
                  await client.call("data.key.delete", { serial: device.serial, password: device.password, keyType: 1, keyCount: 1, keyId });
                } catch (err) {
                  console.error(`[door] revoke data.key.delete failed for ${ownerId}:`, err.message);
                }
              }
            }
            // 无论厂商侧是否成功，都返回待移除的 ownerId/openid（本地数组必须清）
            return { ownerId, openidToRemove: ownerOpenid };
          }),
        );

        for (let i = 0; i < results.length; i++) {
          if (results[i].status === "fulfilled") {
            succeeded.push(chunk[i]);
            allRemoveOwnerIds.push(chunk[i]);
            const v = results[i].value;
            if (v && v.openidToRemove) allRemoveOpenids.push(v.openidToRemove);
          } else {
            failed.push({ id: chunk[i], error: results[i].reason?.message || "unknown_error" });
          }
        }
      }

      // 统一更新设备文档数组（一次读写，无竞态）
      if (allRemoveOwnerIds.length > 0) {
        const currentDev = await db.collection("door_devices").doc(deviceId).get();
        let devData = currentDev && currentDev.data ? currentDev.data : null;
        if (Array.isArray(devData)) devData = devData[0] || null;
        const oldIds = devData ? (devData.grantedOwnerIds || []) : [];
        const oldOpenids = devData ? (devData.grantedOwnerOpenids || []) : [];
        const removeIdSet = new Set(allRemoveOwnerIds);
        const removeOpenidSet = new Set(allRemoveOpenids.filter(Boolean));
        const newIds = oldIds.filter((id) => !removeIdSet.has(id));
        const newOpenids = oldOpenids.filter((oid) => !removeOpenidSet.has(oid));
        // 数组全清时恢复为 all_owners，否则保持 specified_owners
        // 数组全清时恢复为 all_owners，否则保持 specified_owners
        await db.collection("door_devices").doc(deviceId).update({
          grantedOwnerIds: newIds,
          grantedOwnerOpenids: newOpenids,
          permissionMode: newOpenids.length === 0 ? "all_owners" : "specified_owners",
          updatedAt: new Date().toISOString(),
        });

        // 检查被撤销用户是否还有其他设备权限
        const allDevices = await db.collection("door_devices").where({ communityId }).get();
        for (const oid of removeOpenidSet) {
          let hasOther = false;
          for (const d of allDevices.data || []) {
            if (d._id !== deviceId && (d.grantedOwnerOpenids || []).includes(oid)) { hasOther = true; break; }
          }
          if (!hasOther) {
            const certRes = await db.collection("certification_applications")
              .where({ communityId, openid: oid, status: "approved" }).limit(1).get();
            const cert = certRes.data && certRes.data[0] ? certRes.data[0] : null;
            if (cert && cert.fondcardSerial && cert.fondcardUserPassword) {
              try { await client.deleteUser({ serial: cert.fondcardSerial, password: cert.fondcardUserPassword }); } catch (err) { console.error(`[door] revoke deleteUser failed:`, err.message); }
              await db.collection("certification_applications").doc(cert._id).update({
                fondcardId: "", fondcardSerial: "", fondcardUserPassword: "", doorAccessEnabled: false, updatedAt: new Date().toISOString(),
              });
            }
          }
        }
      }

      return res.json({ success: true, data: { succeeded, failed } });
    } catch (error) {
      console.error("/door/device/:deviceId/revoke-permissions error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "revoke_permissions_error",
      });
    }
  },
);

// ============================================================
// 2g. POST /door/visitor-qrcode — 生成访客二维码
// ============================================================
router.post("/door/visitor-qrcode", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const isCloudCall =
      req.header("x-cloud-access-key") &&
      process.env.DOOR_CLOUD_ACCESS_KEY &&
      req.header("x-cloud-access-key") === process.env.DOOR_CLOUD_ACCESS_KEY;

    const { communityId, deviceIds } = req.body || {};

    if (!communityId) {
      return res
        .status(400)
        .json({ success: false, error: "communityId_required" });
    }
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "deviceIds_required" });
    }

    // 权限：云函数调用跳过；管理后台调用需校验
    if (!isCloudCall && user && user.role !== "super" && user.communityId !== communityId) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    // 查 door_devices 获取 vendorDeviceId
    const vendorDeviceIds = [];
    for (const deviceId of deviceIds) {
      const devRes = await db
        .collection("door_devices")
        .doc(deviceId)
        .get();
      let device = devRes && devRes.data ? devRes.data : null;
      if (Array.isArray(device)) device = device[0] || null;
      if (!device) {
        return res.status(404).json({
          success: false,
          error: `device_not_found:${deviceId}`,
        });
      }
      if (device.vendorDeviceId) {
        vendorDeviceIds.push(device.vendorDeviceId);
      }
    }

    if (vendorDeviceIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "no_valid_vendor_device_ids",
      });
    }

    const client = new FondcardClient();
    const defaultLoginId = pickFirst(
      process.env.FONDCARD_DEFAULT_LOGIN_ID,
      "11609",
    );
    const now = new Date();
    const visitDate = Math.floor(
      (now.getTime() + 24 * 60 * 60 * 1000) / 1000,
    );

    const result = await client.buildVisitorQrCode({
      deviceId: vendorDeviceIds.join(","),
      userId: defaultLoginId,
      visitLimit: 0,
      visitDate,
    });

    // 厂商返回 data.qrcode 是二维码内容（可能是 URL 或图片数据）
    const qrcode =
      (result.data && result.data.qrcode) || "";

    return res.json({
      success: true,
      data: { qrcode },
    });
  } catch (error) {
    console.error("/door/visitor-qrcode error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "visitor_qrcode_error",
    });
  }
});

module.exports = router;
