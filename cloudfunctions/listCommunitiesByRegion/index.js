const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 根据省市区查询已注册的小区列表
 */
exports.main = async (event, context) => {
  const { province, city, district } = event;

  try {
    // 构建region数组
    const regionArray = [];
    if (province) regionArray.push(province);
    if (city) regionArray.push(city);
    if (district) regionArray.push(district);

    // 如果没有提供任何区域信息，返回空列表
    if (regionArray.length === 0) {
      return {
        code: 0,
        message: "success",
        data: [],
      };
    }

    // 查询小区列表 - region字段是数组，需要匹配
    const result = await db
      .collection("communities")
      .where({
        region: db.command.eq(regionArray),
      })
      .field({
        name: true,
        address: true,
      })
      .orderBy("name", "asc")
      .get();

    // 去重小区名称
    const uniqueCommunities = [];
    const nameSet = new Set();

    for (const community of result.data) {
      if (!nameSet.has(community.name)) {
        nameSet.add(community.name);
        uniqueCommunities.push({
          name: community.name,
          address: community.address || "",
        });
      }
    }

    return {
      code: 0,
      message: "success",
      data: uniqueCommunities,
    };
  } catch (err) {
    console.error("查询小区列表失败:", err);
    return {
      code: -1,
      message: err.message || "查询小区列表失败",
      data: [],
    };
  }
};
