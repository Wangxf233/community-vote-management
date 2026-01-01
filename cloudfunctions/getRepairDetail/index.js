const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const repairId = event.id;

  try {
    if (!repairId) {
      return {
        success: false,
        error: "缺少记录ID",
      };
    }

    // 先尝试从 repairs 集合查询
    try {
      const result = await db.collection("repairs").doc(repairId).get();
      if (result.data) {
        return {
          success: true,
          data: { ...result.data, type: "repair" },
        };
      }
    } catch (err) {
      // 如果 repairs 中没有，尝试 reports 集合
      const result = await db.collection("reports").doc(repairId).get();
      if (result.data) {
        return {
          success: true,
          data: { ...result.data, type: "report" },
        };
      }
    }

    return {
      success: false,
      error: "记录不存在",
    };
  } catch (error) {
    console.error("获取详情失败:", error);
    return {
      success: false,
      error: error.message || "获取失败",
    };
  }
};
