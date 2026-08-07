const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 提交评价
 * 用户对服务人员进行评价
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { cycleId, staffId, scores, comment, communityId } = event;

  try {
    if (!cycleId || !staffId || !scores) {
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

    // 小区隔离校验
    if (communityId && cycle.communityId && cycle.communityId !== communityId) {
      return { success: false, error: "无权提交该评价" };
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

    // 检查是否已评价过该人员
    const existingEvaluation = await db
      .collection("evaluations")
      .where({
        cycleId: cycleId,
        staffId: staffId,
        openid: openid,
      })
      .get();

    if (existingEvaluation.data.length > 0) {
      return {
        success: false,
        error: "您已经评价过该服务人员",
      };
    }

    // 验证服务人员是否在评价范围内
    if (!cycle.staffIds || !cycle.staffIds.includes(staffId)) {
      return {
        success: false,
        error: "该服务人员不在本次评价范围内",
      };
    }

    // 计算总分
    let totalScore = 0;
    const scoreEntries = Object.entries(scores);
    scoreEntries.forEach(([dimension, score]) => {
      totalScore += Number(score);
    });
    const averageScore = totalScore / scoreEntries.length;

    // 提交评价
    const evaluationData = {
      cycleId: cycleId,
      staffId: staffId,
      communityId: owner.communityId,
      openid: openid,
      userId: owner._id,
      scores: scores,
      totalScore: averageScore,
      comment: comment || "",
      submittedAt: now,
      createdAt: now,
    };

    const result = await db.collection("evaluations").add({
      data: evaluationData,
    });

    return {
      success: true,
      data: {
        _id: result._id,
        ...evaluationData,
      },
    };
  } catch (error) {
    console.error("提交评价失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
