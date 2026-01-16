const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * checkCommunity
 * - 输入: { name | communityName: string, region?: string[] }
 * - 返回: { exists: boolean, exactMatch?: { _id, name, region, address }, candidates?: [ { _id, name, region, address } ], matchedCount }
 * 逻辑: 优先做 name 精确匹配；若未命中，做模糊匹配（包含匹配，返回前 20 个候选），并可根据 region 进行简单优先级过滤。
 */
exports.main = async (event, context) => {
  const name =
    (event &&
      (event.name ||
        event.communityName ||
        (event.data && event.data.name) ||
        (event.data && event.data.communityName))) ||
    "";
  const region = event && (event.region || (event.data && event.data.region)); // optional array

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { success: false, exists: false, candidates: [], matchedCount: 0 };
  }

  try {
    // 1) exact match by name (and region if provided)
    let whereClause = { name: name };

    // If region provided, try exact match with both name and region
    if (region && Array.isArray(region) && region.length >= 3) {
      const exactWithRegionQ = await db
        .collection("communities")
        .where({
          name: name,
          region: db.command.eq(region),
        })
        .limit(1)
        .get();

      if (
        exactWithRegionQ &&
        exactWithRegionQ.data &&
        exactWithRegionQ.data.length > 0
      ) {
        const c = exactWithRegionQ.data[0];
        return {
          success: true,
          exists: true,
          exactMatch: {
            _id: c._id,
            name: c.name,
            region: c.region || [],
            address: c.address || "",
          },
          candidates: [],
          matchedCount: 1,
        };
      }
    }

    // If no region match or region not provided, try name-only match
    const exactQ = await db
      .collection("communities")
      .where({ name: name })
      .limit(1)
      .get();
    if (exactQ && exactQ.data && exactQ.data.length > 0) {
      const c = exactQ.data[0];
      return {
        success: true,
        exists: true,
        exactMatch: {
          _id: c._id,
          name: c.name,
          region: c.region || [],
          address: c.address || "",
        },
        candidates: [],
        matchedCount: 1,
      };
    }

    // 2) fuzzy match using RegExp (case-insensitive, substring)
    const regexp = db.RegExp({
      regexp: name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      options: "i",
    });
    const fuzzyQ = await db
      .collection("communities")
      .where({ name: regexp })
      .limit(50)
      .get();

    let candidates = (fuzzyQ && fuzzyQ.data) || [];

    // If region provided, prefer candidates whose region array contains the provided region elements (simple heuristic)
    if (
      region &&
      Array.isArray(region) &&
      region.length > 0 &&
      candidates.length > 0
    ) {
      const preferred = [];
      const others = [];
      const regionKey = region.join("|");
      for (const item of candidates) {
        const itemRegion = (item.region || []).join("|");
        if (itemRegion.indexOf(regionKey) !== -1) preferred.push(item);
        else others.push(item);
      }
      candidates = preferred.concat(others);
    }

    // map to output shape and limit to 20
    const outCandidates = candidates.slice(0, 20).map((c) => ({
      _id: c._id,
      name: c.name,
      region: c.region || [],
      address: c.address || "",
    }));

    return {
      success: false,
      exists: false,
      candidates: outCandidates,
      matchedCount: (candidates && candidates.length) || 0,
    };
  } catch (err) {
    console.error("checkCommunity error", err);
    return {
      success: false,
      exists: false,
      candidates: [],
      matchedCount: 0,
      error: err && err.message,
    };
  }
};
