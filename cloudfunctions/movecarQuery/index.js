const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 挪车查询 — 根据车牌号查询车辆信息
 * - 普通用户：仅返回车主电话号码（明文拨号）
 * - 工作人员：返回全部车辆信息
 * 仅能查询本小区车辆
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

    // 小区归属校验（防越权）：
    // - 客户端传了 communityId：必须校验调用者确实是该小区的业主/家属或审核通过的工作人员
    // - 没传：从调用者本人的已审核绑定推断
    if (communityId) {
      const [bindingCheck, staffCheck] = await Promise.all([
        db
          .collection("bindings")
          .where({ openid, communityId, status: "approved" })
          .limit(1)
          .get(),
        db
          .collection("staff")
          .where({ openid, communityId, status: "approved" })
          .limit(1)
          .get(),
      ]);

      const isMember =
        (bindingCheck.data && bindingCheck.data.length > 0) ||
        (staffCheck.data && staffCheck.data.length > 0);

      if (!isMember) {
        return { success: false, error: "无权查询该小区车辆" };
      }
    } else {
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

    // 检查当前用户是否是本小区的审核通过工作人员
    let isStaff = false;
    try {
      const staffResult = await db
        .collection("staff")
        .where({
          openid,
          communityId,
          status: "approved",
        })
        .limit(1)
        .get();
      isStaff = !!(staffResult.data && staffResult.data.length > 0);
    } catch (e) {
      // 查 staff 表失败不影响主流程，默认当普通用户
      console.warn("检查工作人员身份失败:", e.message);
    }

    if (isStaff) {
      // 工作人员：返回全部车辆信息
      return {
        success: true,
        data: {
          _id: vehicle._id,
          plateNumber: vehicle.plateNumber,
          vehicleType: vehicle.vehicleType || "",
          ownerName: vehicle.ownerName || "",
          ownerPhone: vehicle.ownerPhone || "",
          parkingFee: vehicle.parkingFee || "",
          parkingSpot: vehicle.parkingSpot || "",
          startDate: vehicle.startDate || "",
          endDate: vehicle.endDate || "",
          building: vehicle.building || "",
          unit: vehicle.unit || "",
          room: vehicle.room || "",
          remark: vehicle.remark || "",
          isStaff: true,
        },
      };
    }

    // 普通用户：仅返回电话号码
    return {
      success: true,
      data: {
        plateNumber: vehicle.plateNumber,
        ownerPhone: vehicle.ownerPhone || "",
        isStaff: false,
      },
    };
  } catch (err) {
    console.error("movecarQuery error:", err);
    return { success: false, error: err.message || "查询失败" };
  }
};
