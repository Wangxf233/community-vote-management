const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 提交物业公司评价
 * 用户对物业公司进行评价
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { cycleId, scores, comment } = event;

  try {
    // 参数验证
    if (!cycleId || !scores) {
      return {
        success: false,
        error: "缺少必填参数",
      };
    }

    // 获取用户信息（从 owner_list 中查询）
    const ownerResult = await db
      .collection("owner_list")
      .where({
        openid: openid,
      })
      .get();

    if (ownerResult.data.length === 0) {
      return {
        success: false,
        error: "未找到用户绑定信息",
      };
    }

    const owner = ownerResult.data[0];

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

    // 验证评价类型
    if (cycle.type !== "company") {
      return {
        success: false,
        error: "评价类型不匹配",
      };
    }

    // 验证评价时间
    const now = new Date();
    const startTime = new Date(cycle.startSubmitTime || cycle.createdAt);
    const deadline = new Date(cycle.deadline);

    if (now < startTime) {
      return {
        success: false,
        error: "评价尚未开始",
      };
    }

    if (now > deadline) {
      return {
        success: false,
        error: "评价已截止",
      };
    }

    // 检查是否已评价过
    const existingEvaluation = await db
      .collection("evaluations")
      .where({
        cycleId: cycleId,
        openid: openid,
      })
      .get();

    if (existingEvaluation.data.length > 0) {
      return {
        success: false,
        error: "您已经评价过该物业公司",
      };
    }

    // 创建评价记录
    const evaluationData = {
      cycleId: cycleId,
      openid: openid,
      userId: owner._id,
      scores: scores,
      comment: comment || "",
      type: "company",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await db.collection("evaluations").add({
      data: evaluationData,
    });

    return {
      success: true,
      message: "评价提交成功",
    };
  } catch (error) {
    console.error("提交物业公司评价失败:", error);
    return {
      success: false,
      error: error.message || "提交评价失败",
    };
  }
};
