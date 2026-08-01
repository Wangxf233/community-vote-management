const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 工作人员车辆查询（完全明文，只读）
 * 步骤：
 * 1. 校验当前用户是否有审核通过的工作人员身份
 * 2. 校验查询的车辆是否属于工作人员所属小区
 * 3. 返回全部车辆信息（含真实手机号）
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { plateNumber } = event;
  let { communityId } = event;

  try {
    // 参数校验
    if (!plateNumber || !plateNumber.trim()) {
      return { success: false, error: "请输入车牌号" };
    }

    // 1. 校验工作人员身份
    const staffWhere = { openid, status: "approved" };
    if (communityId) {
      staffWhere.communityId = communityId;
    }

    const staffResult = await db
      .collection("staff")
      .where(staffWhere)
      .orderBy("createTime", "desc")
      .limit(1)
      .get();

    if (!staffResult.data || staffResult.data.length === 0) {
      return { success: false, error: "无权限：您不是审核通过的工作人员" };
    }

    const staff = staffResult.data[0];
    communityId = staff.communityId;

    // 2. 查询车辆（仅工作人员所属小区）
    const vehicleResult = await db
      .collection("vehicles")
      .where({
        communityId,
        plateNumber: plateNumber.trim(),
      })
      .limit(1)
      .get();

    if (!vehicleResult.data || vehicleResult.data.length === 0) {
      return { success: false, error: "未找到该车辆信息" };
    }

    const vehicle = vehicleResult.data[0];

    // 3. 完全明文返回（工作人员有权限查看所有信息）
    return {
      success: true,
      data: {
        _id: vehicle._id,
        plateNumber: vehicle.plateNumber,
        vehicleType: vehicle.vehicleType || "",
        ownerName: vehicle.ownerName || "",
        ownerPhone: vehicle.ownerPhone || "", // 完全明文，不做脱敏
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
    console.error("staffQueryVehicle error:", err);
    return { success: false, error: err.message || "查询失败" };
  }
};
