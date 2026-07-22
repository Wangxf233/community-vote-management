const cloud = require("wx-server-sdk");

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

exports.main = async () => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    if (!openid) {
      return {
        success: false,
        error: "未获取到用户身份",
      };
    }

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

    if (!communityId) {
      return {
        success: false,
        error: "认证信息缺少小区ID",
        code: "COMMUNITY_MISSING",
      };
    }

    const certInCommunity = (certRes.data || []).filter(
      (item) => item.communityId === communityId,
    );
    const unitKeySet = await buildPermissionSet(communityId, certInCommunity);

    // 检查小区是否已开启门禁功能
    const communityRes = await db
      .collection("communities")
      .doc(communityId)
      .get();
    const communityDoc = Array.isArray(communityRes.data)
      ? communityRes.data[0]
      : communityRes.data;
    if (!communityDoc || communityDoc.doorManagementEnabled !== true) {
      return {
        success: true,
        data: {
          communityId,
          devices: [],
        },
        code: "DOOR_DISABLED",
      };
    }

    const devicesRes = await db
      .collection("door_devices")
      .where({
        communityId,
        enabled: true,
      })
      .orderBy("sort", "asc")
      .get();

    const devices = (devicesRes.data || [])
      .filter((item) => {
        if (isCommunityGate(item)) {
          return true;
        }
        const unitKey = buildUnitKey(item.building, item.unit);
        return !!unitKey && unitKeySet.has(unitKey);
      })
      .map((item) => ({
        id: item._id,
        deviceName: item.deviceName || "未命名门禁",
        serial: item.serial,
        location: item.location || "",
        locationType: item.locationType || "community_gate",
      }));

    return {
      success: true,
      data: {
        communityId,
        devices,
      },
    };
  } catch (error) {
    console.error("listDoorDevices error:", error);
    return {
      success: false,
      error: error.message || "获取门禁设备失败",
    };
  }
};
