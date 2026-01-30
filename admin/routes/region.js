const express = require("express");
const router = express.Router();

// 使用 china-division 提供的省市区数据
const provinces = require("china-division/dist/provinces.json");
const cities = require("china-division/dist/cities.json");
const areas = require("china-division/dist/areas.json");

// 将数据转换为 Element Plus Cascader 需要的格式
function buildRegionTree() {
  // 构建省市区三级树形结构
  const provinceMap = {};
  const cityMap = {};

  // 首先构建所有区县的 map
  areas.forEach((area) => {
    if (!cityMap[area.cityCode]) {
      cityMap[area.cityCode] = [];
    }
    cityMap[area.cityCode].push({
      value: area.name,
      label: area.name,
      code: area.code,
    });
  });

  // 构建所有城市的 map
  cities.forEach((city) => {
    if (!provinceMap[city.provinceCode]) {
      provinceMap[city.provinceCode] = [];
    }
    const cityNode = {
      value: city.name,
      label: city.name,
      code: city.code,
    };

    // 添加该城市下的区县
    if (cityMap[city.code] && cityMap[city.code].length > 0) {
      cityNode.children = cityMap[city.code];
    }

    provinceMap[city.provinceCode].push(cityNode);
  });

  // 构建最终的省份树
  const result = provinces.map((province) => {
    const provinceNode = {
      value: province.name,
      label: province.name,
      code: province.code,
    };

    // 添加该省份下的城市
    if (provinceMap[province.code] && provinceMap[province.code].length > 0) {
      provinceNode.children = provinceMap[province.code];
    }

    return provinceNode;
  });

  return result;
}

// 缓存构建好的数据，避免每次请求都重新构建
let cachedRegionData = null;

// GET /api/regions - 获取省市区数据
router.get("/regions", async (req, res) => {
  try {
    // 如果已经缓存，直接返回
    if (!cachedRegionData) {
      cachedRegionData = buildRegionTree();
    }

    res.json(cachedRegionData);
  } catch (err) {
    console.error("获取省市区数据失败:", err);
    res.status(500).json({ error: "获取省市区数据失败" });
  }
});

module.exports = router;
