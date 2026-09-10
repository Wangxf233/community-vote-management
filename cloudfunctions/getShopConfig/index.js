const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * getShopConfig
 * 按小区名称读取商铺配置（shop_config 集合，管理后台"商铺配置"页维护）
 * 返回门牌号列表、商铺名列表；未配置时返回空数组（小程序端据此置灰对应下拉框）
 *
 * 入参:
 * - communityName: 小区名称
 *
 * 返回:
 * - { code: 0, data: { houseNumbers: [], shopNames: [] } }
 * - { code: -1, message }
 */
exports.main = async (event) => {
  try {
    const { communityName } = event;

    if (!communityName) {
      return { code: -1, message: "缺少小区名称" };
    }

    // 查询小区信息获取 communityId
    const communityRes = await db
      .collection("communities")
      .where({ name: communityName })
      .limit(1)
      .get();

    if (!communityRes.data || communityRes.data.length === 0) {
      return { code: -1, message: "未找到小区" };
    }

    const communityId = communityRes.data[0]._id;

    // 查询商铺配置（每小区一条）
    // 注意：管理后台从未保存过配置时 shop_config 集合可能尚未创建，
    // 查询会抛集合不存在错误，此时同样按"未配置"返回空数组（小程序端置灰下拉框）
    let configRes;
    try {
      configRes = await db
        .collection("shop_config")
        .where({ communityId })
        .limit(1)
        .get();
    } catch (err) {
      if (
        err &&
        (String(err.code || "").includes("DATABASE_COLLECTION_NOT_EXIST") ||
          String(err.errCode || "").includes("DATABASE_COLLECTION_NOT_EXIST") ||
          String(err.message || "").includes("collection not exist"))
      ) {
        return {
          code: 0,
          data: { houseNumbers: [], shopNames: [] },
        };
      }
      throw err;
    }

    if (!configRes.data || configRes.data.length === 0) {
      return {
        code: 0,
        data: { houseNumbers: [], shopNames: [] },
      };
    }

    const config = configRes.data[0];

    // 商铺配置为门牌号+商铺名一一对应的成对行 [{ houseNumber, shopName }]；
    // 兼容旧结构（houseNumbers/shopNames 两个独立数组）
    let shops = [];
    if (Array.isArray(config.shops)) {
      shops = config.shops.filter(
        (s) => s && (s.houseNumber || s.shopName),
      );
    } else {
      const houseNumbers = config.houseNumbers || [];
      const shopNames = config.shopNames || [];
      const maxLen = Math.max(houseNumbers.length, shopNames.length);
      for (let i = 0; i < maxLen; i++) {
        shops.push({
          houseNumber: houseNumbers[i] || "",
          shopName: shopNames[i] || "",
        });
      }
    }

    // 从成对行派生两个下拉列表（去重、去空）；空列表时小程序端对应下拉框置灰
    const houseNumbers = [
      ...new Set(shops.map((s) => s.houseNumber).filter(Boolean)),
    ];
    const shopNames = [...new Set(shops.map((s) => s.shopName).filter(Boolean))];

    return {
      code: 0,
      data: {
        houseNumbers,
        shopNames,
        shops,
      },
    };
  } catch (e) {
    console.error("获取商铺配置失败:", e);
    return { code: -1, message: e.message || "获取商铺配置失败" };
  }
};
