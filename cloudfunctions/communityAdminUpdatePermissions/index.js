const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { adminToken, adminId, permissions } = event || {};
    // 注意：token 验证已在 server.js 中完成

    if (!adminId || !Array.isArray(permissions)) {
      return { success: false, error: "missing params" };
    }

    // 更新权限
    await db
      .collection("users")
      .doc(adminId)
      .update({
        data: {
          permissions,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
