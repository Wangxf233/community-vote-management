const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * getUserCommunities
 * 获取用户所有已审核通过的小区绑定信息
 * 用于切换小区功能
 * 兼容商铺认证（shop_certification_applications 独立集合）
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

    // 并行查询户主/家属认证申请与商铺认证申请（均只返回已审核通过的）
    const [houseRes, shopRes] = await Promise.all([
      db
        .collection("certification_applications")
        .where({
          openid: openid,
          status: "approved", // 只返回已审核通过的
        })
        .get(),
      db
        .collection("shop_certification_applications")
        .where({
          openid: openid,
          status: "approved",
        })
        .get(),
    ]);

    if (!houseRes || !houseRes.data) {
      return {
        success: false,
        message: "查询失败",
      };
    }

    // 合并两类认证申请（商铺类型标记 type: "shop"）
    const allApplications = [
      ...(houseRes.data || []),
      ...((shopRes && shopRes.data) || []).map((item) => ({
        ...item,
        type: "shop",
      })),
    ];

    // 收集所有社区ID，批量查询社区地址
    const communityIds = [
      ...new Set(
        allApplications.map((item) => item.communityId).filter(Boolean),
      ),
    ];
    const communityMap = {};
    if (communityIds.length > 0) {
      const _ = db.command;
      const commRes = await db
        .collection("communities")
        .where({ _id: _.in(communityIds) })
        .get();
      if (commRes.data) {
        commRes.data.forEach((c) => {
          communityMap[c._id] = c;
        });
      }
    }

    // 格式化返回数据
    const bindings = allApplications
      .map((item) => {
        const comm = communityMap[item.communityId] || {};
        return {
          _id: item._id,
          type: item.type || "owner",
          openid: item.openid,
          phone: item.phone,
          name: item.name,
          communityName: item.communityName,
          communityId: item.communityId,
          address: comm.address || "",
          region: item.region || [],
          district: item.district || "",
          building: item.building || "",
          unit: item.unit || "",
          room: item.room || "",
          // 商铺字段（户主/家属记录无此字段，取空）
          houseNumber: item.houseNumber || "",
          shopName: item.shopName || "",
          relation: item.relation || null,
          ownerOpenid: item.ownerOpenid || null,
          ownerName: item.ownerName || null,
          status: item.status,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      })
      // 按更新时间降序排列（与旧实现一致）
      .sort((a, b) => {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tb - ta;
      });

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
