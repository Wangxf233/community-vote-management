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

    // 2b. 查询 communities 集合获取门禁开关状态
    let doorManagementEnabled = false;
    let requireRealName = true; // 默认需要实名
    try {
      const commRes = await db.collection("communities").doc(communityId).get();
      const commDoc = Array.isArray(commRes.data)
        ? commRes.data[0]
        : commRes.data;
      doorManagementEnabled = !!(
        commDoc && commDoc.doorManagementEnabled === true
      );
      requireRealName = commDoc?.requireRealName !== false;
    } catch (e) {
      console.warn(
        "getCommunityInfo: failed to load communities doc",
        e.message,
      );
    }

    // 如果没有找到小区信息，返回空数据而不是报错
    if (!infoResult.data || infoResult.data.length === 0) {
      return {
        success: true,
        communityName: communityName,
        doorManagementEnabled,
        requireRealName,
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
          adImages: [],
          communityHistory: "",
          communityImages: [],
        },
      };
    }

    const communityInfo = infoResult.data[0];

    // 图片链接刷新：用 fileID（或 cloud:// 旧链接）换取新的临时链接，避免上传时保存的 7 天链接过期
    const imagePairs = [
      { urlKey: "planImage", idKey: "planImageFileID", array: false },
      { urlKey: "effectImage", idKey: "effectImageFileID", array: false },
      { urlKey: "adImages", idKey: "adImageFileIDs", array: true },
      { urlKey: "communityImages", idKey: "communityImageFileIDs", array: true },
    ];
    const keys = [];
    const slots = [];
    imagePairs.forEach(({ urlKey, idKey, array }) => {
      if (!array) {
        const id = communityInfo[idKey];
        const url = communityInfo[urlKey];
        let key = "";
        if (id && typeof id === "string" && id.startsWith("cloud://")) key = id;
        else if (typeof url === "string" && url.startsWith("cloud://")) key = url;
        if (key) {
          keys.push(key);
          slots.push({ urlKey, index: null });
        }
      } else {
        const urls = Array.isArray(communityInfo[urlKey])
          ? communityInfo[urlKey]
          : [];
        const ids = Array.isArray(communityInfo[idKey])
          ? communityInfo[idKey]
          : [];
        urls.forEach((u, i) => {
          const id = ids[i];
          let key = "";
          if (id && typeof id === "string" && id.startsWith("cloud://")) key = id;
          else if (typeof u === "string" && u.startsWith("cloud://")) key = u;
          if (key) {
            keys.push(key);
            slots.push({ urlKey, index: i });
          }
        });
      }
    });
    if (keys.length > 0) {
      try {
        const tmpRes = await cloud.getTempFileURL({
          fileList: [...new Set(keys)],
        });
        const urlMap = {};
        (tmpRes.fileList || []).forEach((f) => {
          if (f.fileID && (f.tempFileURL || f.download_url)) {
            urlMap[f.fileID] = f.download_url || f.tempFileURL;
          }
        });
        slots.forEach(({ urlKey, index }, i) => {
          const key = keys[i];
          if (!urlMap[key]) return;
          if (index === null) {
            communityInfo[urlKey] = urlMap[key];
          } else {
            communityInfo[urlKey][index] = urlMap[key];
          }
        });
      } catch (e) {
        console.warn("图片链接刷新失败:", e.message);
      }
    }

    // 3. 返回小区基本情况（字段已经在文档顶层，不需要提取）
    return {
      success: true,
      communityName: communityName,
      doorManagementEnabled,
      requireRealName,
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
        adImages: communityInfo.adImages || [],
        communityHistory: communityInfo.communityHistory || "",
        communityImages: communityInfo.communityImages || [],
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
