const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 获取评价周期列表
 * 用于小程序展示可参与的评价活动
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  console.log("评价周期查询 - 用户openid:", openid);

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

    // 获取该小区的所有服务人员评价周期（不限制状态）
    const _ = db.command;
    const cyclesResult = await db
      .collection("evaluation_cycles")
      .where({
        communityId: communityId,
        // 只返回服务人员评价周期（type为staff或不存在type字段的旧数据）
        type: _.or(_.eq("staff"), _.exists(false)),
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

    // 检查用户是否已经评价过
    const cyclesWithStatus = await Promise.all(
      activeCycles.map(async (cycle) => {
        // 获取用户对该周期的所有评价
        const evaluationResult = await db
          .collection("evaluations")
          .where({
            cycleId: cycle._id,
            openid: openid,
          })
          .get();

        const evaluatedCount = evaluationResult.data.length;
        const totalStaffCount = cycle.staffIds ? cycle.staffIds.length : 0;

        return {
          ...cycle,
          hasEvaluated:
            evaluatedCount >= totalStaffCount && totalStaffCount > 0,
          evaluatedCount: evaluatedCount,
          totalStaffCount: totalStaffCount,
        };
      })
    );

    return {
      success: true,
      data: cyclesWithStatus,
    };
  } catch (error) {
    console.error("获取评价周期列表失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
