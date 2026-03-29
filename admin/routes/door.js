const express = require("express");
const http = require("http");
const https = require("https");
const { db } = require("../config/db");

const router = express.Router();

function postJson(url, body, headers = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const isHttps = target.protocol === "https:";
    const payload = JSON.stringify(body);
    const request = (isHttps ? https : http).request(
      {
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: "POST",
        timeout,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(
                new Error(parsed.error || `gateway_http_${res.statusCode}`),
              );
            }
          } catch (e) {
            reject(new Error("gateway_response_invalid_json"));
          }
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("gateway_request_timeout"));
    });

    request.on("error", reject);
    request.write(payload);
    request.end();
  });
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
    const now = Date.now();
    const payloadObj = {
      cmd: "open_door",
      serial,
      requestId,
      timestamp: now,
      openid,
      source,
    };

    const gatewayUrl = process.env.DOOR_GATEWAY_URL || "http://127.0.0.1:9101";
    const gatewayTimeout = Number(process.env.DOOR_GATEWAY_TIMEOUT_MS || 12000);

    const gatewayRes = await postJson(
      `${gatewayUrl}/internal/door/open`,
      {
        requestId,
        serial,
        payloadObj,
        device,
      },
      {
        "x-gateway-key": process.env.DOOR_GATEWAY_KEY || "",
      },
      gatewayTimeout,
    );

    await db.collection("door_open_logs").add({
      data: {
        openid,
        serial,
        communityId,
        requestId,
        source,
        status:
          gatewayRes &&
          gatewayRes.data &&
          gatewayRes.data.ack &&
          gatewayRes.data.ack.ok === false
            ? "timeout"
            : "sent",
        ack: gatewayRes ? gatewayRes.data && gatewayRes.data.ack : null,
        createdAt: new Date(),
      },
    });

    return res.json({
      success: true,
      data: gatewayRes.data || {},
      message: gatewayRes.message || "开门指令已发送",
    });
  } catch (error) {
    console.error("/door/open-from-cloud error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "door_gateway_error",
    });
  }
});

module.exports = router;
