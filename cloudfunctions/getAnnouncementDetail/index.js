const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 获取公告详情并标记为已读
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

    // 获取公告详情
    const announcementResult = await db
      .collection("announcements")
      .doc(announcementId)
      .get();

    if (!announcementResult.data) {
      return {
        success: false,
        error: "公告不存在",
      };
    }

    const announcement = announcementResult.data;

    // 增加浏览量
    await db
      .collection("announcements")
      .doc(announcementId)
      .update({
        data: {
          viewCount: db.command.inc(1),
        },
      });

    // 标记为已读
    const readResult = await db
      .collection("announcement_reads")
      .where({
        openid: openid,
        announcementId: announcementId,
      })
      .get();

    if (readResult.data.length === 0) {
      await db.collection("announcement_reads").add({
        data: {
          openid: openid,
          announcementId: announcementId,
          readAt: new Date(),
        },
      });
    }

    return {
      success: true,
      data: announcement,
    };
  } catch (error) {
    console.error("获取公告详情失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
