// 云函数：获取用户的评价历史
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { cycleId } = event;
  const { OPENID } = cloud.getWXContext();

  try {
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

    // 获取用户的所有评价记录
    const evaluationsResult = await db
      .collection("evaluations")
      .where({
        cycleId: cycleId,
        openid: OPENID,
      })
      .get();

    // 获取所有被评价的服务人员信息
    const staffIds = evaluationsResult.data.map((e) => e.staffId);
    const staffResult = await db
      .collection("evaluation_staff")
      .where({
        _id: _.in(staffIds),
      })
      .get();

    // 创建人员ID到人员信息的映射
    const staffMap = {};
    staffResult.data.forEach((staff) => {
      staffMap[staff._id] = staff;
    });

    // 合并评价记录和人员信息
    const evaluations = evaluationsResult.data.map((evaluation) => ({
      ...evaluation,
      staff: staffMap[evaluation.staffId] || {},
    }));

    return {
      success: true,
      data: {
        cycle: cycle,
        evaluations: evaluations,
      },
    };
  } catch (error) {
    console.error("获取评价历史失败:", error);
    return {
      success: false,
      error: error.message || "获取评价历史失败",
    };
  }
};
