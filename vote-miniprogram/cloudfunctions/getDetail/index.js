const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const { collection, id } = event;

    if (!collection || !id) {
      return { success: false, error: "missing_params" };
    }

    // 检查集合名称是否合法
    const allowedCollections = [
      "votes",
      "evaluations",
      "repairs",
      "announcements",
      "information",
    ];
    if (!allowedCollections.includes(collection)) {
      return { success: false, error: "invalid_collection" };
    }

    // 获取文档详情
    const res = await db.collection(collection).doc(id).get();

    if (!res || !res.data) {
      return { success: false, error: "not_found" };
    }

    return { success: true, data: res.data };
  } catch (e) {
    console.error("getDetail error:", e);
    return { success: false, error: e.message || String(e) };
  }
};
