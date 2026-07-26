const cloud = require("wx-server-sdk");
const https = require("https");
const http = require("http");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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

function buildUnitKey(building, unit) {
  const b = normalizeNo(building);
  const u = normalizeNo(unit);
  if (!b || !u) {
    return "";
  }
  return `${b}#${u}`;
}

function isCommunityGate(device) {
  if (device.locationType === "community_gate") {
    return true;
  }
  if (device.locationType === "unit_gate") {
    return false;
  }
  return !buildUnitKey(device.building, device.unit);
}

async function buildPermissionSet(communityId, certList) {
  const unitKeySet = new Set();
  const ownerOpenids = new Set();

  for (const cert of certList || []) {
    const unitKey = buildUnitKey(cert.building, cert.unit);
    if (unitKey) {
      unitKeySet.add(unitKey);
    }
    if (cert.type === "family" && cert.ownerOpenid) {
      ownerOpenids.add(cert.ownerOpenid);
    }
  }

  const ownerList = Array.from(ownerOpenids);
  if (ownerList.length) {
    const ownerRes = await db
      .collection("certification_applications")
      .where({
        communityId,
        status: "approved",
        openid: _.in(ownerList),
      })
      .get();

    for (const ownerCert of ownerRes.data || []) {
      const ownerUnitKey = buildUnitKey(ownerCert.building, ownerCert.unit);
      if (ownerUnitKey) {
        unitKeySet.add(ownerUnitKey);
      }
    }
  }

  return unitKeySet;
}

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

    const certInCommunity = (certRes.data || []).filter(
      (item) => item.communityId === communityId,
    );
    const unitKeySet = await buildPermissionSet(communityId, certInCommunity);

    const deviceRes = await db
      .collection("door_devices")
      .where({
        communityId,
        serial,
        enabled: true,
      })
      .limit(1)
      .get();

    if (!deviceRes.data || deviceRes.data.length === 0) {
      return {
        success: false,
        error: "device_not_found",
      };
    }

    const device = deviceRes.data[0];

    // 检查用户是否有该设备的开门权限
    let hasPermission = false;
    // 单独授权模式：只查 door_device_permissions
    if (device.permissionMode === "specified_owners") {
      const familyCert = certInCommunity.find((c) => c.type === "family");
      const ownerOpenidToCheck = familyCert ? familyCert.ownerOpenid : openid;
      const granted = device.grantedOwnerOpenids || [];
      if (granted.includes(openid) || (ownerOpenidToCheck !== openid && granted.includes(ownerOpenidToCheck))) {
        hasPermission = true;
      }
    } else {
      // all_owners 模式：大门门禁所有人可开，单元门禁匹配同楼栋单元
      if (isCommunityGate(device)) {
        hasPermission = true;
      } else {
        const unitKey = buildUnitKey(device.building, device.unit);
        hasPermission = !!unitKey && unitKeySet.has(unitKey);
      }
      // all_owners 模式下也检查设备 grantedOwnerOpenids（额外授权）
      if (!hasPermission) {
        const granted = device.grantedOwnerOpenids || [];
        if (granted.includes(openid)) hasPermission = true;
        if (!hasPermission) {
          const familyCert = certInCommunity.find((c) => c.type === "family");
          if (familyCert && familyCert.ownerOpenid && granted.includes(familyCert.ownerOpenid)) {
            hasPermission = true;
          }
        }
      }
    }

    if (!hasPermission) {
      return { success: false, error: "NO_DOOR_PERMISSION" };
    }

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
