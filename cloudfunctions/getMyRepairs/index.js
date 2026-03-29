const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { communityId } = event;

  try {
    // 构建查询条件
    const whereCondition = {
      openid: openid,
      deleted: _.neq(true),
    };

    // 如果提供了 communityId，则添加小区过滤
    if (communityId) {
      whereCondition.communityId = communityId;
    }

    // 查询当前用户的报修记录，排除已删除的
    const repairsResult = await db
      .collection("repairs")
      .where(whereCondition)
      .orderBy("submitTime", "desc")
      .get();

    // 查询当前用户的报事记录，排除已删除的
    const reportsResult = await db
      .collection("reports")
      .where(whereCondition)
      .orderBy("submitTime", "desc")
      .get();

    // 合并结果，为报修添加type标记
    const repairs = repairsResult.data.map((item) => ({
      ...item,
      type: "repair",
    }));

    const reports = reportsResult.data.map((item) => ({
      ...item,
      type: "report",
    }));

    // 合并并按时间排序
    const allData = [...repairs, ...reports].sort(
      (a, b) => new Date(b.submitTime) - new Date(a.submitTime),
    );

    return {
      success: true,
      data: allData,
    };
  } catch (error) {
    console.error("获取报修记录失败:", error);
    return {
      success: false,
      error: error.message || "获取失败",
    };
  }
};
