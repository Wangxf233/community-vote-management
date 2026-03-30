const express = require("express");
const { db } = require("../config/db");
const { FondcardClient } = require("../utils/fondcard-client");

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

    return res.json({
      success: true,
      data: {
        method: openRes.method,
        result: openRes.result,
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

module.exports = router;
