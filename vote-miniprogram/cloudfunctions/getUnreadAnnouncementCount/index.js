const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

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
 * 获取未读公告数量
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { communityId, type } = event;

  try {
    if (!communityId) {
      return {
        success: false,
        error: "缺少社区ID",
      };
    }

    // 构建查询条件
    const where = {
      communityId: communityId,
      status: "published",
      publishTime: _.lte(new Date()),
    };

    if (type) {
      where.type = type;
    }

    // 获取所有已发布的公告
    const announcementsResult = await db
      .collection("announcements")
      .where(where)
      .field({
        _id: true,
        expiryDays: true,
        expiryTime: true,
        publishTime: true,
      })
      .get();

    // 过滤掉已过期的公告
    const now = new Date();
    const validAnnouncements = announcementsResult.data.filter((item) => {
      const expiryTime = calculateExpiryTime(item);
      if (!expiryTime) return true;
      return now <= expiryTime;
    });

    const announcementIds = validAnnouncements.map((item) => item._id);

    if (announcementIds.length === 0) {
      return {
        success: true,
        data: {
          total: 0,
          unreadCount: 0,
          byType: {
            committee: 0,
            property: 0,
            law: 0,
          },
        },
      };
    }

    // 获取用户已读记录
    const readResult = await db
      .collection("announcement_reads")
      .where({
        openid: openid,
        announcementId: _.in(announcementIds),
      })
      .field({
        announcementId: true,
      })
      .get();

    const readIds = readResult.data.map((item) => item.announcementId);
    const unreadCount = announcementIds.length - readIds.length;

    // 如果需要按类型统计
    let byType = { committee: 0, property: 0, law: 0 };
    if (!type) {
      // 获取所有未读公告的类型
      const unreadIds = announcementIds.filter((id) => !readIds.includes(id));

      if (unreadIds.length > 0) {
        const unreadAnnouncementsResult = await db
          .collection("announcements")
          .where({
            _id: _.in(unreadIds),
          })
          .field({
            type: true,
          })
          .get();

        unreadAnnouncementsResult.data.forEach((item) => {
          if (item.type && byType.hasOwnProperty(item.type)) {
            byType[item.type]++;
          }
        });
      }
    }

    return {
      success: true,
      data: {
        total: announcementIds.length,
        unreadCount: unreadCount,
        byType: byType,
      },
    };
  } catch (error) {
    console.error("获取未读数量失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
