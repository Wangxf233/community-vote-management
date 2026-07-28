const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 挪车查询 — 根据车牌号查询车辆信息
 * 普通用户使用，返回完整车辆信息 + 真实手机号（明文拨号）
 * 仅能查询本小区车辆
 */
exports.main = async (event, context) => {
  const { plateNumber } = event;
  let { communityId } = event;

  try {
    // 参数校验
    if (!plateNumber || !plateNumber.trim()) {
      return { success: false, error: "请输入车牌号" };
    }

    // 如果没传 communityId，从用户认证信息推断
    if (!communityId) {
      const wxContext = cloud.getWXContext();
      const openid = wxContext.OPENID;

      // 尝试从 bindings 表获取当前用户的小区
      const bindingResult = await db
        .collection("bindings")
        .where({ openid, status: "approved" })
        .orderBy("createTime", "desc")
        .limit(1)
        .get();

      if (bindingResult.data && bindingResult.data.length > 0) {
        communityId = bindingResult.data[0].communityId;
      } else {
        return { success: false, error: "无法确定所属小区，请先绑定小区" };
      }
    }

    // 查询车辆（仅本小区）
    const result = await db
      .collection("vehicles")
      .where({
        communityId,
        plateNumber: plateNumber.trim(),
      })
      .limit(1)
      .get();

    if (!result.data || result.data.length === 0) {
      return { success: false, error: "未找到该车辆信息" };
    }

    const vehicle = result.data[0];

    // 明文拨号：直接返回完整车主手机号
    return {
      success: true,
      data: {
        _id: vehicle._id,
        plateNumber: vehicle.plateNumber,
        vehicleType: vehicle.vehicleType || "",
        ownerName: vehicle.ownerName || "",
        ownerPhone: vehicle.ownerPhone || "", // 明文返回
        parkingFee: vehicle.parkingFee || "",
        parkingSpot: vehicle.parkingSpot || "",
        startDate: vehicle.startDate || "",
        endDate: vehicle.endDate || "",
        building: vehicle.building || "",
        unit: vehicle.unit || "",
        room: vehicle.room || "",
        remark: vehicle.remark || "",
      },
    };
  } catch (err) {
    console.error("movecarQuery error:", err);
    return { success: false, error: err.message || "查询失败" };
  }
};
