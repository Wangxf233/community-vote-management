const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 查询当前用户的工作人员审核状态
 * 支持多小区、多身份场景
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { communityId } = event;

  try {
    const where = { openid };

    // 如果传了 communityId，只查该小区的
    if (communityId) {
      where.communityId = communityId;
    }

    const result = await db
      .collection("staff")
      .where(where)
      .orderBy("createTime", "desc")
      .get();

    const staffList = result.data || [];

    // 找到第一个审核通过的
    const approved = staffList.find((s) => s.status === "approved");
    // 找到第一个待审核的
    const pending = staffList.find((s) => s.status === "pending");

    return {
      success: true,
      data: {
        hasStaff: staffList.length > 0,
        isApproved: !!approved,
        hasPending: !!pending,
        approvedStaff: approved || null,
        pendingStaff: pending || null,
        allStaff: staffList,
      },
    };
  } catch (err) {
    console.error("getMyStaffStatus error:", err);
    return { success: false, error: err.message || "查询失败" };
  }
};
