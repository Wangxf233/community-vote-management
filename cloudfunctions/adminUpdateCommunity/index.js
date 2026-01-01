const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { adminToken, communityId, updates } = event || {};
    // 注意：token 验证已在 server.js 中完成，此处不再重复验证
    if (!communityId || !updates)
      return { success: false, error: "missing params" };

    updates.updatedAt = new Date();
    await db
      .collection("communities")
      .doc(communityId)
      .update({ data: updates });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
