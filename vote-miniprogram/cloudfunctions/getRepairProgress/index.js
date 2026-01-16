const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { communityId, userId } = event;

  try {
    // 查询当前用户在该社区的报修记录，按提交时间倒序，排除已删除的
    const result = await db
      .collection("repairs")
      .where({
        communityId: communityId,
        userId: userId,
        deleted: _.neq(true),
      })
      .orderBy("submitTime", "desc")
      .limit(20)
      .get();

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error("获取报修进度失败:", error);
    return {
      success: false,
      error: error.message || "获取失败",
    };
  }
};
