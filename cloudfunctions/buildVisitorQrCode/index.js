/**
 * 生成访客开门二维码云函数
 * 流程：调 admin API → admin 调厂商 → 返回二维码
 */
const cloud = require("wx-server-sdk");
const https = require("https");
const http = require("http");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DOOR_API_BASE_URL = process.env.DOOR_API_BASE_URL;
const DOOR_CLOUD_ACCESS_KEY = process.env.DOOR_CLOUD_ACCESS_KEY;

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) return { success: false, error: "未获取到用户身份" };

    const { deviceId } = event;
    if (!deviceId) return { success: false, error: "缺少设备ID参数" };

    // 1. 验证认证状态，获取 communityId
    const certRes = await db
      .collection("certification_applications")
      .where({ openid, status: "approved" })
      .orderBy("updatedAt", "desc").limit(1).get();
    if (!certRes.data || certRes.data.length === 0) {
      return { success: false, error: "当前账号未完成认证" };
    }
    const communityId = certRes.data[0].communityId;

    // 2. 验证设备存在
    const devRes = await db.collection("door_devices").doc(deviceId).get();
    let device = devRes && devRes.data ? devRes.data : null;
    if (Array.isArray(device)) device = device[0] || null;
    if (!device) return { success: false, error: "设备不存在" };
    if (!device.vendorDeviceId) {
      return { success: false, error: "设备未在厂商平台注册，无法生成访客二维码" };
    }

    // 3. 调 admin API 生成二维码
    if (!DOOR_API_BASE_URL) {
      return { success: false, error: "云函数未配置 DOOR_API_BASE_URL 环境变量" };
    }
    if (!DOOR_CLOUD_ACCESS_KEY) {
      return { success: false, error: "云函数未配置 DOOR_CLOUD_ACCESS_KEY 环境变量" };
    }

    const payload = JSON.stringify({ communityId, deviceIds: [deviceId] });
    const target = new URL(`${DOOR_API_BASE_URL.replace(/\/$/, "")}/api/door/visitor-qrcode`);
    const isHttps = target.protocol === "https:";

    const result = await new Promise((resolve, reject) => {
      const req = (isHttps ? https : http).request({
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: "POST",
        timeout: 12000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "x-cloud-access-key": DOOR_CLOUD_ACCESS_KEY,
        },
      }, (res) => {
        let raw = "";
        res.on("data", (c) => { raw += c; });
        res.on("end", () => {
          try { resolve(raw ? JSON.parse(raw) : {}); }
          catch (e) { reject(new Error("admin_response_invalid_json")); }
        });
      });
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", reject);
      req.write(payload);
      req.end();
    });

    if (result && result.success && result.data && result.data.qrcode) {
      return { success: true, data: { qrcode: result.data.qrcode } };
    }
    const adminError = (result && result.error) || "";
    if (!adminError && (!result || !result.success)) {
      return { success: false, error: "生成二维码失败，厂商未返回二维码数据" };
    }
    if (adminError.includes("vendorDeviceId") || adminError.includes("no_valid")) {
      return { success: false, error: "该设备缺少厂商注册ID，请重新添加设备" };
    }
    return { success: false, error: adminError || "生成二维码失败，请稍后重试" };
  } catch (error) {
    console.error("buildVisitorQrCode error:", error);
    return { success: false, error: error.message || "生成访客二维码失败" };
  }
};
