const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { adminToken, bindingId, action, reason } = event || {};
    // action: 'approve' | 'reject'
    // 注意：token 验证已在 server.js 中完成，此处不再重复验证
    // 但仍需要 admin 信息用于审计日志，所以需要从 token 查询
    let admin = null;
    if (adminToken) {
      const res = await db
        .collection("users")
        .where({ token: adminToken })
        .limit(1)
        .get();
      if (res && res.data && res.data.length > 0) {
        admin = res.data[0];
      }
    }
    if (!bindingId) return { success: false, error: "missing bindingId" };
    if (!action || (action !== "approve" && action !== "reject"))
      return { success: false, error: "invalid action" };

    const now = new Date();
    const updateData = {
      status: action === "approve" ? "approved" : "failed",
      reviewedAt: now,
      reviewedBy: admin._id || admin._openid || admin.openid || null,
    };
    if (action === "reject") updateData.failReason = reason || "管理员驳回";

    await db.collection("bindings").doc(bindingId).update({ data: updateData });

    // 写审计日志
    await db.collection("admin_audit").add({
      data: {
        action,
        bindingId,
        reason: reason || "",
        adminId: admin._id || null,
        adminOpenid: admin._openid || admin.openid || null,
        createdAt: now,
      },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
