const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * getHouseConfig
 * 根据小区名称获取房屋结构配置
 *
 * 参数:
 * - communityName: 小区名称
 * - type: 配置类型 (house/shop)，默认为house
 *
 * 返回:
 * - buildings: 房屋结构数组
 * - type: 配置类型
 * - district: 小区期/区号
 */
exports.main = async (event, context) => {
  try {
    const { communityName, type } = event;

    if (!communityName) {
      return { code: -1, message: "请提供小区名称" };
    }

    // 查询小区信息
    const communityRes = await db
      .collection("communities")
      .where({ name: communityName })
      .limit(1)
      .get();

    if (!communityRes.data || communityRes.data.length === 0) {
      return { code: -1, message: "未找到该小区" };
    }

    const community = communityRes.data[0];
    const communityId = community._id;

    // 构建查询条件
    const whereCondition = { communityId };
    if (type) {
      whereCondition.type = type;
    }

    // 查询房屋配置
    const configRes = await db
      .collection("house_config")
      .where(whereCondition)
      .limit(1)
      .get();

    if (!configRes.data || configRes.data.length === 0) {
      return {
        code: 0,
        data: {
          buildings: [],
          type: type || "house",
          district: "1",
        },
      };
    }

    const config = configRes.data[0];

    return {
      code: 0,
      data: {
        buildings: config.buildings || [],
        type: config.type || "house",
        district: config.district || "1",
      },
    };
  } catch (error) {
    console.error("getHouseConfig error:", error);
    return { code: -1, message: error.message || "获取配置失败" };
  }
};
