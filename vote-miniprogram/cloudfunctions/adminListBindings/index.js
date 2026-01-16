// 管理员：分页列出绑定申请（支持筛选 status, communityName）
const cloud = require("wx-server-sdk");
cloud.init();

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const {
      adminToken,
      page = 1,
      pageSize = 20,
      status,
      communityName,
    } = event || {};
    // 注意：token 验证已在 server.js 中完成，此处不再重复验证

    const query = {};
    if (status) query.status = status;
    if (communityName)
      query.communityName = cloud.database().RegExp({
        regexp: communityName,
        options: "i",
      });

    const skip = Math.max(0, page - 1) * pageSize;
    const listRes = await db
      .collection("bindings")
      .where(query)
      .orderBy("submittedAt", "desc")
      .skip(skip)
      .limit(pageSize)
      .get();

    // count total
    const countRes = await db.collection("bindings").where(query).count();

    return {
      success: true,
      data: listRes.data || [],
      total: countRes.total || 0,
    };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
