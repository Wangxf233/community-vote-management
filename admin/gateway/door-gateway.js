const express = require("express");
const bodyParser = require("body-parser");
const mqtt = require("mqtt");

const app = express();
app.use(bodyParser.json({ limit: "512kb" }));

const clients = new Map();

function fillTemplate(input, context) {
  if (!input) {
    return null;
  }

  if (typeof input === "object") {
    const raw = JSON.stringify(input);
    return JSON.parse(fillTemplate(raw, context));
  }

  return String(input).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return context[key] !== undefined && context[key] !== null
      ? String(context[key])
      : "";
  });
}

function getClient(device) {
  const key = `${device.brokerUrl}::${device.mqttUsername || ""}`;
  if (clients.has(key)) {
    return clients.get(key);
  }

  const options = {
    username: device.mqttUsername || "",
    password: device.mqttPassword || "",
    clientId:
      (device.clientIdPrefix || "door_gateway") +
      "_" +
      Math.random().toString(36).slice(2, 10),
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 1000,
  };

  const client = mqtt.connect(device.brokerUrl, options);
  client.on("error", (err) => {
    console.error("mqtt client error:", err.message);
  });

  clients.set(key, client);
  return client;
}

function waitForAck(client, responseTopic, requestId, timeoutMs) {
  return new Promise((resolve) => {
    let finished = false;

    const done = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      client.off("message", onMessage);
      resolve(result);
    };

    const onMessage = (topic, messageBuffer) => {
      if (topic !== responseTopic) {
        return;
      }
      const raw = messageBuffer.toString();
      try {
        const parsed = JSON.parse(raw);
        if (!parsed.requestId || parsed.requestId === requestId) {
          done({ ok: true, payload: parsed });
        }
      } catch (_) {
        done({ ok: true, payload: raw });
      }
    };

    const timer = setTimeout(() => {
      done({ ok: false, reason: "ACK_TIMEOUT" });
    }, timeoutMs);

    client.on("message", onMessage);
  });
}

function ensureConnected(client) {
  if (client.connected) {
    return Promise.resolve(true);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("mqtt_connect_timeout")),
      12000,
    );

    const onConnect = () => {
      clearTimeout(timer);
      client.off("error", onError);
      resolve(true);
    };

    const onError = (err) => {
      clearTimeout(timer);
      client.off("connect", onConnect);
      reject(err);
    };

    client.once("connect", onConnect);
    client.once("error", onError);
  });
}

app.get("/internal/health", (req, res) => {
  res.json({
    success: true,
    ts: Date.now(),
    clients: clients.size,
  });
});

app.post("/internal/door/open", async (req, res) => {
  try {
    const gatewayKey = req.header("x-gateway-key") || "";
    if (
      !process.env.DOOR_GATEWAY_KEY ||
      gatewayKey !== process.env.DOOR_GATEWAY_KEY
    ) {
      return res
        .status(401)
        .json({ success: false, error: "invalid_gateway_key" });
    }

    const { requestId, serial, payloadObj, device } = req.body || {};
    if (!requestId || !serial || !payloadObj || !device) {
      return res
        .status(400)
        .json({ success: false, error: "missing_required_fields" });
    }

    if (!device.brokerUrl || !device.openTopic) {
      return res
        .status(400)
        .json({ success: false, error: "mqtt_config_missing" });
    }

    const rendered = fillTemplate(
      device.commandTemplate || payloadObj,
      payloadObj,
    );
    const payload =
      typeof rendered === "string" ? rendered : JSON.stringify(rendered);

    const client = getClient(device);
    await ensureConnected(client);

    let ackPromise = null;
    if (device.responseTopic) {
      await new Promise((resolve, reject) => {
        client.subscribe(device.responseTopic, { qos: 1 }, (err) => {
          if (err) return reject(err);
          resolve(true);
        });
      });

      ackPromise = waitForAck(
        client,
        device.responseTopic,
        requestId,
        Number(device.ackTimeoutMs) > 0 ? Number(device.ackTimeoutMs) : 5000,
      );
    }

    await new Promise((resolve, reject) => {
      client.publish(
        device.openTopic,
        payload,
        {
          qos: Number.isInteger(device.qos) ? device.qos : 1,
          retain: !!device.retain,
        },
        (err) => {
          if (err) return reject(err);
          resolve(true);
        },
      );
    });

    const ack = ackPromise ? await ackPromise : null;
    return res.json({
      success: true,
      message:
        ack && ack.ok === false ? "指令已发送，设备未确认" : "开门指令已发送",
      data: {
        requestId,
        ack,
      },
    });
  } catch (error) {
    console.error("gateway open error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "gateway_open_error",
    });
  }
});

const port = Number(process.env.DOOR_GATEWAY_PORT || 9101);
const host = process.env.DOOR_GATEWAY_HOST || "127.0.0.1";
app.listen(port, host, () => {
  console.log(`[door-gateway] listening on http://${host}:${port}`);
});

process.on("SIGINT", () => {
  for (const client of clients.values()) {
    try {
      client.end(true);
    } catch (_) {}
  }
  process.exit(0);
});
