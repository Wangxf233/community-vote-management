const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

/**
 * 获取公告列表
 * 用于小程序展示信息公示
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { type, page = 1, pageSize = 10 } = event;

  try {
    // 从 owner_list 中获取用户信息
    const ownerResult = await db
      .collection("owner_list")
      .where({
        openid: openid,
      })
      .get();

    if (ownerResult.data.length === 0) {
      return {
        success: false,
        error: "未绑定用户信息",
      };
    }

    const owner = ownerResult.data[0];
    const communityId = owner.communityId;

    const skip = (page - 1) * pageSize;
    const now = new Date();

    const where = {
      communityId: communityId,
      status: "published",
      publishTime: _.lte(now),
    };

    if (type) {
      where.type = type;
    }

    // 获取总数
    const countResult = await db
      .collection("announcements")
      .where(where)
      .count();

    // 获取列表
    const result = await db
      .collection("announcements")
      .where(where)
      .orderBy("isPinned", "desc")
      .orderBy("publishTime", "desc")
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取用户的阅读记录
    const announcementIds = result.data.map((item) => item._id);
    const readRecords = await db
      .collection("announcement_reads")
      .where({
        openid: openid,
        announcementId: _.in(announcementIds),
      })
      .get();

    const readMap = {};
    readRecords.data.forEach((record) => {
      readMap[record.announcementId] = true;
    });

    // 标记已读状态
    const announcements = result.data.map((item) => ({
      ...item,
      isRead: !!readMap[item._id],
    }));

    return {
      success: true,
      data: {
        list: announcements,
        total: countResult.total,
      },
    };
  } catch (error) {
    console.error("获取公告列表失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
