const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * getFamilyList
 * 户主获取自己的家属列表
 *
 * 返回:
 * - list: 家属列表
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { communityId } = event;

    if (!openid) {
      return { code: -1, message: "无法获取用户身份" };
    }

    // 构建查询条件
    const ownerWhereCondition = {
      openid,
      type: "owner",
      status: "approved",
    };

    // 如果提供了 communityId，则添加小区过滤
    if (communityId) {
      ownerWhereCondition.communityId = communityId;
    }

    // 验证当前用户是否为已认证的户主
    const ownerRes = await db
      .collection("certification_applications")
      .where(ownerWhereCondition)
      .limit(1)
      .get();

    if (!ownerRes.data || ownerRes.data.length === 0) {
      return { code: -1, message: "只有已认证的户主才能查看家属列表" };
    }

    // 构建家属查询条件
    const familyWhereCondition = {
      ownerOpenid: openid,
      type: "family",
      status: "approved",
    };

    // 如果提供了 communityId，则添加小区过滤
    if (communityId) {
      familyWhereCondition.communityId = communityId;
    }

    // 查询该户主的所有已通过的家属
    const familyRes = await db
      .collection("certification_applications")
      .where(familyWhereCondition)
      .orderBy("createdAt", "desc")
      .get();

    const list = (familyRes.data || []).map((item) => ({
      _id: item._id,
      name: item.name,
      phone: item.phone,
      relation: item.relation,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return {
      code: 0,
      data: {
        list,
        total: list.length,
      },
    };
  } catch (error) {
    console.error("getFamilyList error:", error);
    return { code: -1, message: error.message || "获取家属列表失败" };
  }
};
