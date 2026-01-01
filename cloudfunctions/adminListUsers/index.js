const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { adminToken, page = 1, pageSize = 50, query } = event || {};
    // 注意：token 验证已在 server.js 中完成，此处不再重复验证

    const q = {};
    if (query && query.name) {
      q.nickName = db.RegExp({ regexp: query.name, options: "i" });
    }
    if (query && query.openid) {
      q.openid = query.openid;
    }

    const skip = Math.max(0, page - 1) * pageSize;
    const listRes = await db
      .collection("users")
      .where(q)
      .orderBy("createdAt", "desc")
      .skip(skip)
      .limit(pageSize)
      .get();
    const countRes = await db.collection("users").where(q).count();

    return {
      success: true,
      data: listRes.data || [],
      total: countRes.total || 0,
    };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
