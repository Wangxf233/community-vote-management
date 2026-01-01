const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * getUserCommunities
 * 获取用户所有已审核通过的小区绑定信息
 * 用于切换小区功能
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = event.openid || wxContext.OPENID;

    if (!openid) {
      return {
        success: false,
        message: "缺少用户标识",
      };
    }

    // 查询用户所有已审核通过的认证申请
    const result = await db
      .collection("certification_applications")
      .where({
        openid: openid,
        status: "approved", // 只返回已审核通过的
      })
      .orderBy("updatedAt", "desc") // 按更新时间降序排列
      .get();

    if (!result || !result.data) {
      return {
        success: false,
        message: "查询失败",
      };
    }

    // 格式化返回数据
    const bindings = result.data.map((item) => ({
      _id: item._id,
      type: item.type || "owner",
      openid: item.openid,
      phone: item.phone,
      name: item.name,
      communityName: item.communityName,
      communityId: item.communityId,
      region: item.region || [],
      district: item.district || "",
      building: item.building || "",
      unit: item.unit || "",
      room: item.room || "",
      relation: item.relation || null,
      ownerOpenid: item.ownerOpenid || null,
      ownerName: item.ownerName || null,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return {
      success: true,
      bindings: bindings,
      count: bindings.length,
    };
  } catch (err) {
    console.error("getUserCommunities error:", err);
    return {
      success: false,
      message: err.message || "获取用户小区列表失败",
      error: err,
    };
  }
};
