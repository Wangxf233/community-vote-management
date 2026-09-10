const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * getBindingInfo
 * - If event.mock is provided ('pending'|'failed'|'approved') returns canned data for testing
 * - Otherwise resolves current user by cloud.getWXContext().OPENID (or event.openid) and
 *   returns the most relevant binding record.
 * - 优先返回用户在 users.currentCommunityId 中保存的当前小区（切换小区时记录，
 *   本地缓存清除后仍能恢复到上次使用的小区），再按
 *   已通过户主 → 已通过商铺 → 最近一条未删除申请 的顺序兜底。
 * Response shape:
 * { success: true, binding?: {...}, }
 */
function buildHouseBinding(cert) {
  return {
    _id: cert._id,
    type: cert.type || "owner",
    phone: cert.phone,
    name: cert.name,
    communityName: cert.communityName,
    communityId: cert.communityId,
    region: cert.region || [],
    district: cert.district || "",
    building: cert.building || "",
    unit: cert.unit || "",
    room: cert.room || "",
    relation: cert.relation || null,
    ownerOpenid: cert.ownerOpenid || null,
    ownerName: cert.ownerName || null,
    status: cert.status || "pending",
    rejectReason: cert.rejectReason || null,
    createdAt: cert.createdAt,
    updatedAt: cert.updatedAt,
  };
}

function buildShopBinding(cert) {
  return {
    _id: cert._id,
    type: "shop",
    phone: cert.phone,
    name: cert.name,
    communityName: cert.communityName,
    communityId: cert.communityId,
    region: cert.region || [],
    district: "",
    building: "",
    unit: "",
    room: "",
    houseNumber: cert.houseNumber || "",
    shopName: cert.shopName || "",
    relation: null,
    ownerOpenid: null,
    ownerName: null,
    status: cert.status || "pending",
    rejectReason: cert.rejectReason || null,
    createdAt: cert.createdAt,
    updatedAt: cert.updatedAt,
  };
}

// 读取用户在云端保存的当前小区
// 优先 user_preferences 集合（setUserCommunity 写入），兼容早期 users.currentCommunityId
async function getSavedCommunityId(openid) {
  try {
    const prefRes = await db
      .collection("user_preferences")
      .where({ openid })
      .limit(1)
      .get();
    if (
      prefRes.data &&
      prefRes.data.length > 0 &&
      prefRes.data[0].currentCommunityId
    ) {
      return prefRes.data[0].currentCommunityId;
    }
  } catch (err) {
    console.error("getSavedCommunityId(user_preferences) error:", err);
  }

  // 兼容：早期版本曾尝试写入 users.currentCommunityId
  try {
    const userRes = await db
      .collection("users")
      .where({ openid })
      .limit(1)
      .get();
    const user = userRes.data && userRes.data[0];
    return (user && user.currentCommunityId) || null;
  } catch (err) {
    console.error("getSavedCommunityId(users) error:", err);
    return null;
  }
}

exports.main = async (event, context) => {
  const mock = event && event.mock;
  if (mock === "pending") {
    return {
      exists: true,
      bindingId: "mock-pending-1",
      info: {
        communityName: "和平小区",
        region: ["广东省", "深圳市", "南山区"],
        building: "A座",
        block: "1单元",
        room: "101",
      },
      status: "pending",
      failReason: null,
    };
  }
  if (mock === "failed") {
    return {
      exists: true,
      bindingId: "mock-failed-1",
      info: {
        communityName: "阳光花园",
        region: ["广东省", "深圳市", "福田区"],
        building: "B座",
        block: "2单元",
        room: "202",
      },
      status: "failed",
      failReason: "证件信息不完整",
    };
  }
  if (mock === "approved") {
    return {
      exists: true,
      bindingId: "mock-approved-1",
      info: {
        communityName: "荣华小区",
        region: ["广东省", "深圳市", "南山区"],
        building: "C座",
        block: "3单元",
        room: "303",
      },
      status: "approved",
      failReason: null,
    };
  }

  try {
    const wxContext = cloud.getWXContext();
    const openid = (wxContext && wxContext.OPENID) || (event && event.openid);
    if (!openid) {
      return { success: false, error: "no_openid" };
    }

    // 1. 优先返回云端保存的当前小区（切换小区时记录，缓存清除后仍可恢复）
    const savedCommunityId = await getSavedCommunityId(openid);
    if (savedCommunityId) {
      const [savedHouseRes, savedShopRes] = await Promise.all([
        db
          .collection("certification_applications")
          .where({
            openid: openid,
            status: "approved",
            communityId: savedCommunityId,
          })
          .orderBy("createdAt", "desc")
          .limit(1)
          .get(),
        db
          .collection("shop_certification_applications")
          .where({
            openid: openid,
            status: "approved",
            communityId: savedCommunityId,
          })
          .orderBy("createdAt", "desc")
          .limit(1)
          .get(),
      ]);

      if (savedHouseRes && savedHouseRes.data && savedHouseRes.data.length > 0) {
        return {
          success: true,
          binding: buildHouseBinding(savedHouseRes.data[0]),
        };
      }
      if (savedShopRes && savedShopRes.data && savedShopRes.data.length > 0) {
        return {
          success: true,
          binding: buildShopBinding(savedShopRes.data[0]),
        };
      }
      // 保存的小区已无有效认证（如申请被删除），继续走下面的兜底逻辑
    }

    // 2. 其次返回已通过的户主认证
    const certRes = await db
      .collection("certification_applications")
      .where({
        openid: openid,
        type: "owner",
        status: "approved",
      })
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (certRes && certRes.data && certRes.data.length > 0) {
      return {
        success: true,
        binding: buildHouseBinding(certRes.data[0]),
      };
    }

    // 3. 再次返回已通过的商铺认证（独立集合；避免被旧的被拒/待审房屋申请遮蔽）
    const shopApprovedRes = await db
      .collection("shop_certification_applications")
      .where({
        openid: openid,
        status: "approved",
      })
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (shopApprovedRes && shopApprovedRes.data && shopApprovedRes.data.length > 0) {
      return {
        success: true,
        binding: buildShopBinding(shopApprovedRes.data[0]),
      };
    }

    // 4. 兜底：返回最近一条未删除的申请（户主/家属或商铺），用于展示待审核/被拒状态
    const [houseFallbackRes, shopFallbackRes] = await Promise.all([
      db
        .collection("certification_applications")
        .where({
          openid: openid,
          status: _.neq("removed"),
        })
        .orderBy("createdAt", "desc")
        .limit(1)
        .get(),
      db
        .collection("shop_certification_applications")
        .where({
          openid: openid,
        })
        .orderBy("createdAt", "desc")
        .limit(1)
        .get(),
    ]);

    const houseCert = houseFallbackRes && houseFallbackRes.data && houseFallbackRes.data[0];
    const shopCert = shopFallbackRes && shopFallbackRes.data && shopFallbackRes.data[0];

    // 两集合都有记录时，取提交时间更新的一条
    let chosen = null;
    let isShop = false;
    if (houseCert && shopCert) {
      if (
        new Date(shopCert.createdAt).getTime() >
        new Date(houseCert.createdAt).getTime()
      ) {
        chosen = shopCert;
        isShop = true;
      } else {
        chosen = houseCert;
      }
    } else if (shopCert) {
      chosen = shopCert;
      isShop = true;
    } else if (houseCert) {
      chosen = houseCert;
    }

    if (chosen) {
      return {
        success: true,
        binding: isShop ? buildShopBinding(chosen) : buildHouseBinding(chosen),
      };
    }

    // 没有找到认证记录
    return { success: true, binding: null };
  } catch (err) {
    console.error("getBindingInfo error", err);
    return { success: false, error: err.message };
  }
};
