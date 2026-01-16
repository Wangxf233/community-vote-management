const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/**
 * submitRepair - 提交报修
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    const {
      communityId,
      equipment,
      location,
      description,
      images = [],
      video = "",
      isUrgent = false,
      userId,
      userName,
    } = event;

    // 参数验证
    if (!communityId || !equipment || !location || !description) {
      return { success: false, error: "缺少必填参数" };
    }

    // 直接写入云数据库
    const db = cloud.database();

    const repairData = {
      communityId,
      equipment,
      location,
      description,
      images,
      video,
      isUrgent,
      status: "pending", // pending, processing, completed
      remark: "",
      userId: userId || openid, // 优先使用传入的 userId，否则使用当前 openid
      openid: openid, // 同时保存 openid 字段
      userName,
      submitTime: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("repairs").add({
      data: repairData,
    });

    return {
      success: true,
      data: {
        _id: result._id,
        ...repairData,
      },
    };
  } catch (err) {
    console.error("submitRepair error:", err);
    return {
      success: false,
      error: err.message || "提交失败",
    };
  }
};
