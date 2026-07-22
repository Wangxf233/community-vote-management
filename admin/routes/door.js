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
    const openRes = await openDoorViaFondcard({
      device,
      serial,
      openid,
      communityId,
      requestId,
      source,
    });

    let logPersisted = true;
    try {
      await db.collection("door_open_logs").add({
        data: {
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
        },
      });
    } catch (logError) {
      logPersisted = false;
      console.error("door_open_logs add failed:", logError);
    }

    return res.json({
      success: true,
      data: {
        method: openRes.method,
        result: openRes.result,
        logPersisted,
      },
      message: logPersisted
        ? "开门HTTP请求已提交"
        : "开门HTTP请求已提交（日志写入失败）",
    });
  } catch (error) {
    console.error("/door/open-from-cloud error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "door_open_http_error",
    });
  }
});

module.exports = router;
