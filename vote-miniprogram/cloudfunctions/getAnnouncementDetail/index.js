const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 计算有效期截止时间
 */
function calculateExpiryTime(announcement) {
  if (announcement.expiryTime) {
    return new Date(announcement.expiryTime);
  }

  if (announcement.expiryDays && announcement.publishTime) {
    const publishTime = new Date(announcement.publishTime);
    const expiryTime = new Date(
      publishTime.getTime() + announcement.expiryDays * 24 * 60 * 60 * 1000
    );
    return expiryTime;
  }

  return null;
}

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

    // 检查公告是否已过期
    const now = new Date();
    const expiryTime = calculateExpiryTime(announcement);
    if (expiryTime && now > expiryTime) {
      return {
        success: false,
        error: "该公告已过期",
      };
    }

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
