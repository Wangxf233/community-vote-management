const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    // 首先查询 owner_list 表（户主管理页审核通过的数据）
    const ownerListRes = await db
      .collection("owner_list")
      .where({
        openid: openid,
        deleted: _.neq(true),
      })
      .get();

    // 如果 owner_list 有数据，优先使用
    if (ownerListRes.data && ownerListRes.data.length > 0) {
      return {
        success: true,
        data: ownerListRes.data,
      };
    }

    // 如果 owner_list 没有数据，查询 bindings 表（用户提交的认证信息）
    const bindingsRes = await db
      .collection("bindings")
      .where({
        openid: openid,
        status: "approved", // 只显示审核通过的
        deleted: _.neq(true),
      })
      .get();

    return {
      success: true,
      data: bindingsRes.data,
    };
  } catch (err) {
    console.error("getMyHouses error:", err);
    return {
      success: false,
      error: err.message || "Failed to get houses",
    };
  }
};
