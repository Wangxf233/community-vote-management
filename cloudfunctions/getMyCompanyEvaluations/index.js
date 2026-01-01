const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 获取我的物业公司评价历史
 * 用户查看自己对物业公司的历史评价
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { cycleId } = event;

  try {
    if (!cycleId) {
      return {
        success: false,
        error: "缺少评价周期ID",
      };
    }

    // 获取评价周期信息
    const cycleResult = await db
      .collection("evaluation_cycles")
      .doc(cycleId)
      .get();

    if (!cycleResult.data) {
      return {
        success: false,
        error: "评价周期不存在",
      };
    }

    const cycle = cycleResult.data;

    // 获取用户的评价记录
    const evaluationResult = await db
      .collection("evaluations")
      .where({
        cycleId: cycleId,
        openid: openid,
      })
      .get();

    if (evaluationResult.data.length === 0) {
      return {
        success: false,
        error: "未找到评价记录",
      };
    }

    // 物业公司评价只有一条记录，但为了和前端保持一致，返回数组格式
    const evaluations = evaluationResult.data;

    return {
      success: true,
      data: {
        cycle: cycle,
        evaluations: evaluations,
      },
    };
  } catch (error) {
    console.error("获取物业公司评价历史失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
