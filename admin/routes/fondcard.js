const express = require("express");
const { verifyToken } = require("../middleware/auth");
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
      "loginPassword",
      "platform",
      "serial",
      "devicePassword",
      "deviceNo",
      "deviceType",
      "mac",
      "algorithm",
      "startDate",
      "keyDate",
    ];

    // 允许传入已存在的 loginId，跳过 data.login.add，便于重试后续步骤。
    if (!body.loginId) {
      requiredKeys.push("name", "company");
    }

    const missing = required(body, requiredKeys);

    if (missing.length) {
      return res
        .status(400)
        .json({ success: false, error: "missing_required_fields", missing });
    }

    const client = new FondcardClient();

    let loginId = body.loginId || null;
    let loginRes = null;

    if (!loginId) {
      loginRes = await client.addLogin({
        name: body.name,
        password: body.loginPassword,
        company: body.company,
        platform: body.platform,
        domainMqtt: body.domainMqtt,
        domainQr: body.domainQr,
        urlAdmin: body.urlAdmin,
      });

      loginId = loginRes && loginRes.data ? loginRes.data.id : null;
      debug.loginId = loginId || null;
      debug.stepResults.loginRes = loginRes;
      if (!loginId) {
        return res.status(500).json({
          success: false,
          error: "login_id_missing_in_response",
          raw: loginRes,
        });
      }
    } else {
      loginRes = {
        skipped: true,
        reason: "use_provided_loginId",
        data: { id: loginId },
      };
      debug.loginId = loginId;
      debug.stepResults.loginRes = loginRes;
    }

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
    if (body.includeDeviceMeta === true) {
      devicePayload.deviceId = body.deviceId;
      devicePayload.sourceid = body.sourceid;
      devicePayload.sn = body.sn;
      devicePayload.mac = body.mac;
      devicePayload.btkey = body.btkey;
      devicePayload.btkeyType = body.btkeyType;
      devicePayload.scanOpen = body.scanOpen;
      devicePayload.id = body.id;
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
    const keyId = toHex8(appUserId);

    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: "key_id_missing",
        message:
          "data.user.add 返回 id 非数字，无法按文档转换为 8 位16进制 keyId",
      });
    }

    const keyType = 1;
    const keyCount = body.keyCount || 1;
    const periodNo = body.periodNo || "0";

    const keyRes = await client.addKey({
      serial: body.serial,
      password: body.devicePassword,
      keyType,
      keyCount,
      keyId,
      keyDate: body.keyDate,
      startDate: body.startDate,
      periodNo,
    });
    debug.stepResults.keyRes = keyRes;

    const updateRes = await client.mqttKeyUpdate({
      serial: body.serial,
      password: body.devicePassword,
      userId: loginId,
    });
    debug.stepResults.updateRes = updateRes;

    return res.json({
      success: true,
      data: {
        loginId,
        deviceExists,
        appUserId,
        keyId,
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
