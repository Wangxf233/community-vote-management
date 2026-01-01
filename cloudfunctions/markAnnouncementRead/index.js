const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 标记公告为已读
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { announcementId } = event;

  try {
    if (!announcementId) {
      return {
        success: false,
        error: "缺少公告ID",
      };
    }

    // 检查是否已标记
    const existingRead = await db
      .collection("announcement_reads")
      .where({
        openid: openid,
        announcementId: announcementId,
      })
      .get();

    if (existingRead.data.length > 0) {
      return {
        success: true,
        message: "已经标记为已读",
      };
    }

    // 添加已读记录
    await db.collection("announcement_reads").add({
      data: {
        openid: openid,
        announcementId: announcementId,
        readAt: new Date(),
      },
    });

    return {
      success: true,
      message: "标记已读成功",
    };
  } catch (error) {
    console.error("标记已读失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
