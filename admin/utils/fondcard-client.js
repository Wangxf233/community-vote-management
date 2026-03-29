const crypto = require("crypto");
const http = require("http");
const https = require("https");

function md5(text) {
  return crypto.createHash("md5").update(String(text)).digest("hex");
}

function sanitizeParams(params = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

function postForm(url, form, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const isHttps = target.protocol === "https:";
    const payload = new URLSearchParams(form).toString();

    const req = (isHttps ? https : http).request(
      {
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: "POST",
        timeout,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            const data = raw ? JSON.parse(raw) : {};
            resolve(data);
          } catch (error) {
            reject(new Error(`fondcard_response_invalid_json:${raw}`));
          }
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("fondcard_request_timeout"));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

class FondcardClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.FONDCARD_API_BASE_URL || "";
    this.timeout = Number(
      options.timeout || process.env.FONDCARD_API_TIMEOUT_MS || 12000,
    );

    if (!this.baseUrl) {
      throw new Error("missing_fondcard_api_base_url");
    }
  }

  async call(method, params = {}) {
    const url = `${this.baseUrl}${this.baseUrl.includes("?") ? "&" : "?"}method=${encodeURIComponent(method)}`;
    const result = await postForm(url, sanitizeParams(params), this.timeout);

    if (result && Number(result.code) === 0) {
      return result;
    }

    const code = result && result.code !== undefined ? result.code : "unknown";
    const message = (result && result.message) || "fondcard_api_error";
    const error = new Error(`${method}:${code}:${message}`);
    error.method = method;
    error.code = code;
    error.raw = result;
    throw error;
  }

  async addLogin(params) {
    const payload = {
      ...params,
      password: md5(params.password),
    };
    return this.call("data.login.add", payload);
  }

  async updateLogin(params) {
    const payload = {
      ...params,
    };
    if (payload.password) {
      payload.password = md5(payload.password);
    }
    return this.call("data.login.update", payload);
  }

  async addDevice(params) {
    return this.call("data.device.add", params);
  }

  async addLoginDevice(params) {
    const payload = {
      ...params,
      password: md5(params.password),
    };
    return this.call("data.login.device.add", payload);
  }

  async addUser(params) {
    return this.call("data.user.add", params);
  }

  async addKey(params) {
    return this.call("data.key.add", params);
  }

  async mqttKeyUpdate(params) {
    return this.call("mqtt.key.update", params);
  }
}

module.exports = {
  FondcardClient,
  md5,
};
