const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { adminToken, adminId } = event || {};
    // 注意：token 验证已在 server.js 中完成

    if (!adminId) {
      return { success: false, error: "missing adminId" };
    }

    // 检查是否是总管理员，总管理员不能删除
    const adminRes = await db.collection("users").doc(adminId).get();
    if (!adminRes || !adminRes.data) {
      return { success: false, error: "admin_not_found" };
    }

    if (adminRes.data.isPrimaryAdmin) {
      return { success: false, error: "cannot_delete_primary_admin" };
    }

    await db.collection("users").doc(adminId).remove();

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
