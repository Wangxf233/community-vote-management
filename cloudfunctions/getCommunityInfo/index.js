const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 获取小区基本情况
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  let communityId = event.communityId; // 优先使用传入的communityId
  let communityName = "小区基本情况";

  try {
    // 1. 如果没有传入communityId，则从用户的认证申请信息中获取
    if (!communityId) {
      const certResult = await db
        .collection("certification_applications")
        .where({
          openid: openid,
          status: "approved",
        })
        .orderBy("updatedAt", "desc")
        .limit(1)
        .get();

      if (!certResult.data || certResult.data.length === 0) {
        return {
          success: false,
          error: "未找到已认证的绑定信息",
        };
      }

      const certification = certResult.data[0];
      communityId = certification.communityId;
      communityName = certification.communityName || "小区基本情况";

      if (!communityId) {
        return {
          success: false,
          error: "认证信息中缺少小区ID",
        };
      }
    }

    // 2. 查询小区基本情况
    const infoResult = await db
      .collection("community_info")
      .where({
        communityId: communityId,
      })
      .limit(1)
      .get();

    // 如果没有找到小区信息，返回空数据而不是报错
    if (!infoResult.data || infoResult.data.length === 0) {
      return {
        success: true,
        communityName: communityName,
        data: {
          propertyName: "",
          buildingCount: 0,
          unitCount: 0,
          residentialCount: 0,
          shopCount: 0,
          ownerCount: 0,
          landArea: 0,
          buildingArea: 0,
          exclusiveArea: {
            residential: 0,
            shop: 0,
            other: 0,
          },
          parkingArea: 0,
          surfaceParkingCount: 0,
          undergroundParkingCount: 0,
          vehicleCount: 0,
          planImage: "",
          effectImage: "",
        },
      };
    }

    const communityInfo = infoResult.data[0];

    // 3. 返回小区基本情况（字段已经在文档顶层，不需要提取）
    return {
      success: true,
      communityName: communityName,
      data: {
        propertyName: communityInfo.propertyName || "",
        buildingCount: communityInfo.buildingCount || 0,
        unitCount: communityInfo.unitCount || 0,
        residentialCount: communityInfo.residentialCount || 0,
        shopCount: communityInfo.shopCount || 0,
        ownerCount: communityInfo.ownerCount || 0,
        landArea: communityInfo.landArea || 0,
        buildingArea: communityInfo.buildingArea || 0,
        exclusiveArea: communityInfo.exclusiveArea || {
          residential: 0,
          shop: 0,
          other: 0,
        },
        parkingArea: communityInfo.parkingArea || 0,
        surfaceParkingCount: communityInfo.surfaceParkingCount || 0,
        undergroundParkingCount: communityInfo.undergroundParkingCount || 0,
        vehicleCount: communityInfo.vehicleCount || 0,
        planImage: communityInfo.planImage || "",
        effectImage: communityInfo.effectImage || "",
      },
    };
  } catch (err) {
    console.error("获取小区基本情况失败:", err);
    return {
      success: false,
      error: err.message || "获取小区基本情况失败",
    };
  }
};
