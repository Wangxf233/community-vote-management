const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { db } = require("../config/db");
const { FondcardClient } = require("../utils/fondcard-client");

const router = express.Router();

function required(body, keys) {
  const missing = [];
  for (const key of keys) {
    if (body[key] === undefined || body[key] === null || body[key] === "") {
      missing.push(key);
    }
  }
  return missing;
}

function toHex8(numValue) {
  const n = Number(numValue);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n.toString(16).toUpperCase().padStart(8, "0").slice(-8);
}

function extractListItems(result) {
  const data = result && result.data;
  if (!data) {
    return [];
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data.list)) {
    return data.list;
  }
  if (Array.isArray(data.rows)) {
    return data.rows;
  }
  if (Array.isArray(data.items)) {
    return data.items;
  }
  if (typeof data === "object") {
    return [data];
  }
  return [];
}

router.post("/door/fondcard/login/add", verifyToken, async (req, res) => {
  try {
    const missing = required(req.body || {}, [
      "name",
      "password",
      "company",
      "platform",
    ]);
    if (missing.length) {
      return res
        .status(400)
        .json({ success: false, error: "missing_required_fields", missing });
    }

    const client = new FondcardClient();
    const result = await client.addLogin(req.body);
    return res.json({ success: true, result });
  } catch (error) {
    console.error("fondcard login.add error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/door/fondcard/device/add", verifyToken, async (req, res) => {
  try {
    const missing = required(req.body || {}, [
      "serial",
      "password",
      "deviceNo",
      "deviceType",
      "algorithm",
      "platform",
    ]);
    if (missing.length) {
      return res
        .status(400)
        .json({ success: false, error: "missing_required_fields", missing });
    }

    const client = new FondcardClient();
    const result = await client.addDevice(req.body);
    return res.json({ success: true, result });
  } catch (error) {
    console.error("fondcard device.add error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post(
  "/door/fondcard/login-device/add",
  verifyToken,
  async (req, res) => {
    try {
      const missing = required(req.body || {}, [
        "loginId",
        "password",
        "serial",
      ]);
      if (missing.length) {
        return res
          .status(400)
          .json({ success: false, error: "missing_required_fields", missing });
      }

      const client = new FondcardClient();
      const result = await client.addLoginDevice(req.body);
      return res.json({ success: true, result });
    } catch (error) {
      console.error("fondcard login.device.add error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

router.post(
  "/door/fondcard/login-device/delete",
  verifyToken,
  async (req, res) => {
    try {
      const missing = required(req.body || {}, [
        "loginId",
        "password",
        "serial",
      ]);
      if (missing.length) {
        return res
          .status(400)
          .json({ success: false, error: "missing_required_fields", missing });
      }

      const client = new FondcardClient();
      const result = await client.call("data.login.device.delete", {
        loginId: req.body.loginId,
        password: req.body.password,
        serial: req.body.serial,
      });
      return res.json({ success: true, result });
    } catch (error) {
      console.error("fondcard login.device.delete error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

router.post(
  "/door/fondcard/login-devices/get",
  verifyToken,
  async (req, res) => {
    try {
      const missing = required(req.body || {}, ["loginId", "password"]);
      if (missing.length) {
        return res
          .status(400)
          .json({ success: false, error: "missing_required_fields", missing });
      }

      const payload = {
        loginId: req.body.loginId,
        password: req.body.password,
      };
      if (req.body.pageIndex !== undefined && req.body.pageIndex !== null) {
        payload.pageIndex = Number(req.body.pageIndex);
      }
      if (req.body.pageSize !== undefined && req.body.pageSize !== null) {
        payload.pageSize = Number(req.body.pageSize);
      }
      if (
        req.body.serial !== undefined &&
        req.body.serial !== null &&
        req.body.serial !== ""
      ) {
        payload.serial = req.body.serial;
      }

      const client = new FondcardClient();
      const result = await client.call("data.login.devices.get", payload);
      return res.json({ success: true, result });
    } catch (error) {
      console.error("fondcard login.devices.get error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },
);

router.post("/door/fondcard/user/add", verifyToken, async (req, res) => {
  try {
    const missing = required(req.body || {}, ["platform"]);
    if (missing.length) {
      return res
        .status(400)
        .json({ success: false, error: "missing_required_fields", missing });
    }

    const client = new FondcardClient();
    const result = await client.addUser(req.body);
    return res.json({ success: true, result });
  } catch (error) {
    console.error("fondcard user.add error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/door/fondcard/key/add", verifyToken, async (req, res) => {
  try {
    const missing = required(req.body || {}, [
      "serial",
      "password",
      "keyType",
      "keyCount",
      "keyId",
      "keyDate",
      "startDate",
    ]);
    if (missing.length) {
      return res
        .status(400)
        .json({ success: false, error: "missing_required_fields", missing });
    }

    const client = new FondcardClient();
    const result = await client.addKey(req.body);
    return res.json({ success: true, result });
  } catch (error) {
    console.error("fondcard key.add error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/door/fondcard/mqtt-key/update", verifyToken, async (req, res) => {
  try {
    const missing = required(req.body || {}, ["serial", "password", "userId"]);
    if (missing.length) {
      return res
        .status(400)
        .json({ success: false, error: "missing_required_fields", missing });
    }

    const client = new FondcardClient();
    const result = await client.mqttKeyUpdate(req.body);
    return res.json({ success: true, result });
  } catch (error) {
    console.error("fondcard mqtt.key.update error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/door/fondcard/login/update", verifyToken, async (req, res) => {
  try {
    const missing = required(req.body || {}, ["platform"]);
    if (missing.length) {
      return res
        .status(400)
        .json({ success: false, error: "missing_required_fields", missing });
    }

    const client = new FondcardClient();
    const result = await client.updateLogin(req.body);
    return res.json({ success: true, result });
  } catch (error) {
    console.error("fondcard login.update error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/door/fondcard/login/query", verifyToken, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.platform) {
      return res.status(400).json({
        success: false,
        error: "missing_required_fields",
        missing: ["platform"],
      });
    }

    if (!body.loginId && !body.name) {
      return res.status(400).json({
        success: false,
        error: "missing_query_criteria",
        message: "请至少提供 loginId 或 name 其中之一",
      });
    }

    const client = new FondcardClient();
    const payload = {
      platform: body.platform,
      company: body.company,
      id: body.loginId,
      name: body.name,
      page: body.page,
      pageSize: body.pageSize,
    };

    const methods =
      Array.isArray(body.methods) && body.methods.length
        ? body.methods
        : ["data.login.get", "data.login.list"];

    const attempts = [];
    for (const method of methods) {
      try {
        const result = await client.call(method, payload);
        const items = extractListItems(result);

        let matched = null;
        if (body.loginId) {
          matched =
            items.find((it) => String(it.id) === String(body.loginId)) || null;
        }
        if (!matched && body.name) {
          matched =
            items.find((it) => String(it.name || "") === String(body.name)) ||
            null;
        }

        const matchedLoginId = matched
          ? matched.id
          : items[0]
            ? items[0].id
            : null;

        return res.json({
          success: true,
          data: {
            method,
            matchedLoginId,
            items,
            raw: result,
          },
        });
      } catch (error) {
        attempts.push({
          method,
          error: error.message,
          code: error.code !== undefined ? error.code : null,
          raw: error.raw || null,
        });
      }
    }

    return res.status(502).json({
      success: false,
      error: "fondcard_login_query_failed",
      attempts,
    });
  } catch (error) {
    console.error("fondcard login.query error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/door/fondcard/bootstrap", verifyToken, async (req, res) => {
  const debug = {
    loginId: null,
    stepResults: {},
  };

  try {
    const body = req.body || {};
    const requiredKeys = [
      "loginId",
      "loginPassword",
      "platform",
      "serial",
      "devicePassword",
      "deviceNo",
      "deviceType",
      "mac",
      "algorithm",
      "sourceid",
      "id",
      "keyId",
      "keyType",
      "keyCount",
      "startDate",
      "keyDate",
    ];

    const missing = required(body, requiredKeys);

    if (missing.length) {
      return res
        .status(400)
        .json({ success: false, error: "missing_required_fields", missing });
    }

    const client = new FondcardClient();

    const loginId = body.loginId;
    const loginRes = {
      skipped: true,
      reason: "use_provided_loginId",
      data: { id: loginId },
    };
    debug.loginId = loginId;
    debug.stepResults.loginRes = loginRes;

    const devicePayload = {
      serial: body.serial,
      password: body.devicePassword,
      deviceNo: body.deviceNo,
      deviceType: body.deviceType,
      mac: body.mac,
      algorithm: body.algorithm,
      platform: body.platform,
    };

    // 默认仅提交文档必填参数，避免可选字段格式差异导致 1006。
    devicePayload.sourceid = body.sourceid;
    devicePayload.id = body.id;
    if (body.sn !== undefined) {
      devicePayload.sn = body.sn;
    }
    if (body.btkey !== undefined) {
      devicePayload.btkey = body.btkey;
    }
    if (body.btkeyType !== undefined) {
      devicePayload.btkeyType = body.btkeyType;
    }
    if (body.scanOpen !== undefined) {
      devicePayload.scanOpen = body.scanOpen;
    }

    let deviceRes = null;
    let deviceExists = false;
    try {
      deviceRes = await client.addDevice(devicePayload);
      debug.stepResults.deviceRes = deviceRes;
    } catch (error) {
      if (error.method === "data.device.add" && Number(error.code) === 1006) {
        deviceExists = true;
        deviceRes = {
          skipped: true,
          reason: "device_already_exists",
          code: 1006,
          raw: error.raw || null,
        };
        debug.stepResults.deviceRes = deviceRes;
      } else {
        throw error;
      }
    }

    const bindRes = await client.addLoginDevice({
      loginId,
      password: body.loginPassword,
      serial: body.serial,
    });
    debug.stepResults.bindRes = bindRes;

    const userRes = await client.addUser({
      platform: body.platform,
      userId: body.userId,
    });
    debug.stepResults.userRes = userRes;

    const mqttUser = userRes && userRes.data ? userRes.data : {};
    const appUserId = mqttUser.id;

    const keyIds = String(body.keyId || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const keyDates = String(body.keyDate || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const startDates = String(body.startDate || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const fallbackKeyId = toHex8(loginId);
    if (!keyIds.length && fallbackKeyId) {
      keyIds.push(fallbackKeyId);
    }

    if (!keyIds.length) {
      return res.status(400).json({
        success: false,
        error: "key_id_missing",
        message: "keyId 为空，且无法从 loginId 自动生成有效的 8 位16进制 keyId",
      });
    }

    if (keyIds.some((x) => !/^[0-9A-Fa-f]{8}$/.test(x))) {
      return res.status(400).json({
        success: false,
        error: "invalid_key_id",
        message: "keyId 必须是半角逗号分隔的 8 位16进制字符串",
      });
    }

    if (!keyDates.length || !startDates.length) {
      return res.status(400).json({
        success: false,
        error: "missing_key_dates",
        message: "keyDate 与 startDate 必须传入UTC秒，支持半角逗号分隔",
      });
    }

    if (
      keyDates.some((x) => !/^\d+$/.test(x)) ||
      startDates.some((x) => !/^\d+$/.test(x))
    ) {
      return res.status(400).json({
        success: false,
        error: "invalid_key_dates",
        message: "keyDate 与 startDate 必须为UTC秒数字，多个值请用半角逗号分隔",
      });
    }

    const keyId = keyIds.join(",");

    const keyType = Number(body.keyType);
    const keyCount = Number(body.keyCount || 1);
    const periodNo = body.periodNo || "0";

    if (!Number.isFinite(keyType) || keyType <= 0) {
      return res.status(400).json({
        success: false,
        error: "invalid_key_type",
      });
    }

    if (!Number.isFinite(keyCount) || keyCount <= 0) {
      return res.status(400).json({
        success: false,
        error: "invalid_key_count",
      });
    }

    if (keyIds.length !== keyCount) {
      return res.status(400).json({
        success: false,
        error: "invalid_key_count_mismatch",
        message: "keyCount 必须与 keyId 个数一致",
      });
    }

    if (keyDates.length !== keyCount || startDates.length !== keyCount) {
      return res.status(400).json({
        success: false,
        error: "invalid_key_dates_count_mismatch",
        message: "keyDate/startDate 的个数必须与 keyCount 一致",
      });
    }

    const keyRes = await client.addKey({
      serial: body.serial,
      password: body.devicePassword,
      keyType,
      keyCount,
      keyId,
      keyDate: keyDates.join(","),
      startDate: startDates.join(","),
      periodNo,
    });
    debug.stepResults.keyRes = keyRes;

    const updateRes = await client.mqttKeyUpdate({
      serial: body.serial,
      password: body.devicePassword,
      userId: loginId,
    });
    debug.stepResults.updateRes = updateRes;

    const user = req.user || {};
    const effectiveCommunityId = user.communityId || body.communityId || null;
    if (effectiveCommunityId) {
      const now = new Date().toISOString();
      const existing = await db
        .collection("door_devices")
        .where({
          communityId: effectiveCommunityId,
          serial: body.serial,
        })
        .limit(1)
        .get();

      const snapshot = {
        communityId: effectiveCommunityId,
        serial: body.serial,
        password: body.devicePassword,
        platform: body.platform,
        loginId: String(loginId),
        deviceName: body.deviceName || body.serial || "未命名门禁",
        enabled: true,
        locationType: "community_gate",
        sourceid: body.sourceid,
        deviceType: Number(body.deviceType),
        algorithm: Number(body.algorithm),
        keyType,
        keyCount,
        keyId,
        startDate: startDates.join(","),
        keyDate: keyDates.join(","),
        updatedAt: now,
        updatedBy: user._id || user.id || user.username || "",
      };

      if (existing.data && existing.data.length > 0) {
        await db
          .collection("door_devices")
          .doc(existing.data[0]._id)
          .update(snapshot);
      } else {
        await db.collection("door_devices").add({
          ...snapshot,
          createdAt: now,
          createdBy: user._id || user.id || user.username || "",
        });
      }
    }

    return res.json({
      success: true,
      data: {
        loginId,
        deviceExists,
        appUserId,
        keyId,
        operator: {
          userId: req.user ? req.user._id || req.user.id || null : null,
          communityId: req.user
            ? req.user.communityId || req.body?.communityId || null
            : null,
        },
        mqttUser,
        stepResults: {
          loginRes,
          deviceRes,
          bindRes,
          userRes,
          keyRes,
          updateRes,
        },
      },
    });
  } catch (error) {
    console.error("fondcard bootstrap error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      method: error.method || null,
      code: error.code !== undefined ? error.code : null,
      raw: error.raw || null,
      partial: debug,
    });
  }
});

module.exports = router;
