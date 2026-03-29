const cloud = require("wx-server-sdk");
const https = require("https");
const http = require("http");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function postJson(url, body, headers = {}, timeout = 12000) {
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
              reject(new Error(parsed.error || `admin_http_${res.statusCode}`));
            }
          } catch (e) {
            reject(new Error("admin_response_invalid_json"));
          }
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("admin_request_timeout"));
    });
    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { serial } = event;

  if (!openid) {
    return {
      success: false,
      error: "未获取到用户身份",
    };
  }

  if (!serial) {
    return {
      success: false,
      error: "缺少门禁设备序列号",
    };
  }

  try {
    const certRes = await db
      .collection("certification_applications")
      .where({
        openid,
        status: "approved",
      })
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get();

    if (!certRes.data || certRes.data.length === 0) {
      return {
        success: false,
        error: "当前账号未完成认证，暂不可使用开门功能",
        code: "NO_APPROVED_BINDING",
      };
    }

    const certification = certRes.data[0];
    const communityId = certification.communityId;

    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const apiBaseUrl = process.env.DOOR_API_BASE_URL;
    const accessKey = process.env.DOOR_CLOUD_ACCESS_KEY;

    if (!apiBaseUrl || !accessKey) {
      return {
        success: false,
        error: "开门服务未配置（DOOR_API_BASE_URL/DOOR_CLOUD_ACCESS_KEY）",
      };
    }

    const adminRes = await postJson(
      `${apiBaseUrl.replace(/\/$/, "")}/api/door/open-from-cloud`,
      {
        openid,
        serial,
        communityId,
        requestId,
      },
      {
        "x-cloud-access-key": accessKey,
      },
      Number(process.env.DOOR_API_TIMEOUT_MS || 12000),
    );

    return {
      success: true,
      data: {
        requestId,
        ack: adminRes && adminRes.data ? adminRes.data.ack : null,
      },
      message: (adminRes && adminRes.message) || "开门指令已发送",
    };
  } catch (error) {
    console.error("openDoor error:", error);
    return {
      success: false,
      error: error.message || "开门失败",
    };
  }
};
