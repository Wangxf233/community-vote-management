const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { adminToken, userId, updates } = event || {};
    // 注意：token 验证已在 server.js 中完成，此处不再重复验证
    if (!userId || !updates) return { success: false, error: "missing params" };

    // If assigning a community admin, enforce maxAdmins per community
    if (updates.role === "community" && updates.communityId) {
      // read community to get maxAdmins
      const c = await db
        .collection("communities")
        .doc(updates.communityId)
        .get();
      const maxAdmins = (c && c.data && c.data.maxAdmins) || 10;
      // count current community admins
      const cnt = await db
        .collection("users")
        .where({ role: "community", communityId: updates.communityId })
        .count();
      const current = (cnt && cnt.total) || 0;
      if (current >= maxAdmins) {
        return { success: false, error: "max_admins_reached" };
      }
    }

    updates.updatedAt = new Date();
    await db.collection("users").doc(userId).update({ data: updates });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
