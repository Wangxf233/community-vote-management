const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 获取物业公司评价周期列表
 * 用于小程序展示可参与的物业公司评价活动
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  console.log("物业公司评价周期查询 - 用户openid:", openid);

  try {
    // 从 owner_list 中获取用户信息
    const ownerResult = await db
      .collection("owner_list")
      .where({
        openid: openid,
      })
      .get();

    console.log("owner_list 查询结果:", ownerResult.data);

    if (ownerResult.data.length === 0) {
      return {
        success: false,
        error: "未绑定用户信息",
      };
    }

    const owner = ownerResult.data[0];
    const communityId = owner.communityId;

    // 获取当前时间
    const now = new Date();

    // 获取该小区的所有物业公司评价周期
    const cyclesResult = await db
      .collection("evaluation_cycles")
      .where({
        communityId: communityId,
        type: "company",
      })
      .orderBy("createdAt", "desc")
      .get();

    // 过滤出真正在时间范围内的周期（动态判断）
    const activeCycles = cyclesResult.data.filter((cycle) => {
      const startTime = new Date(cycle.startSubmitTime || cycle.createdAt);
      const deadline = new Date(cycle.deadline);
      // 只返回已开始且未截止的评价
      return now >= startTime && now < deadline;
    });

    // 检查用户是否已经评价过（物业公司评价每个周期只需评价一次）
    const cyclesWithStatus = await Promise.all(
      activeCycles.map(async (cycle) => {
        // 获取用户对该周期的评价
        const evaluationResult = await db
          .collection("evaluations")
          .where({
            cycleId: cycle._id,
            openid: openid,
          })
          .get();

        return {
          ...cycle,
          hasEvaluated: evaluationResult.data.length > 0,
        };
      })
    );

    return {
      success: true,
      data: cyclesWithStatus,
    };
  } catch (error) {
    console.error("获取物业公司评价周期列表失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
