const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { adminToken, bindingId } = event || {};
    // 注意：token 验证已在 server.js 中完成，此处不再重复验证
    if (!bindingId) return { success: false, error: "missing bindingId" };

    const res = await db.collection("bindings").doc(bindingId).get();
    if (!res || !res.data) return { success: false, error: "not_found" };

    return { success: true, data: res.data };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
