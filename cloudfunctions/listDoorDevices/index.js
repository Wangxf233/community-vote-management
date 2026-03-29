const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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

    if (!communityId) {
      return {
        success: false,
        error: "认证信息缺少小区ID",
        code: "COMMUNITY_MISSING",
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

    const devices = (devicesRes.data || []).map((item) => ({
      id: item._id,
      deviceName: item.deviceName || "未命名门禁",
      serial: item.serial,
      location: item.location || "",
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
