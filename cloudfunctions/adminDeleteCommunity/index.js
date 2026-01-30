const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { adminToken, communityId } = event || {};
    // 注意：token 验证已在 server.js 中完成，此处不再重复验证
    // 因为 wx-server-sdk 和 @cloudbase/node-sdk 连接的是不同的数据库环境

    if (!communityId) return { success: false, error: "missing communityId" };

    // 软删除：标记为deleted和deletedAt，保疓30天
    const now = new Date();
    await db
      .collection("communities")
      .doc(communityId)
      .update({
        data: {
          deleted: true,
          deletedAt: now,
          updatedAt: now,
        },
      });

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
