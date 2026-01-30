const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

// utility to build where clause from filters
function buildWhere(db, filters) {
  const q = {};
  if (!filters) return q;
  if (filters.name) {
    q.name = db.RegExp({ regexp: filters.name, options: "i" });
  }
  // region: array [province, city, district]
  if (filters.region && Array.isArray(filters.region)) {
    // match prefix elements if provided
    if (filters.region[0]) q["region.0"] = filters.region[0];
    if (filters.region[1]) q["region.1"] = filters.region[1];
    if (filters.region[2]) q["region.2"] = filters.region[2];
  }
  if (filters.ownerName) {
    q.ownerName = db.RegExp({ regexp: filters.ownerName, options: "i" });
  }
  if (filters.ownerPhone) {
    q.ownerPhone = filters.ownerPhone;
  }
  // date ranges: productStart/productEnd
  // We'll handle ranges in the query flow below since cloud DB SDK doesn't support complex range mixing in simple object
  return q;
}

exports.main = async (event, context) => {
  try {
    const {
      adminToken,
      page = 1,
      pageSize = 50,
      query = {},
      sortField = "productStart",
      sortOrder = "desc",
    } = event || {};
    // 注意：token 验证已在 server.js 中完成，此处不再重复验证
    const admin = adminToken ? true : false; // 简单标记是否有 token

    // build base where
    const baseWhere = buildWhere(db, query);
    // 过滤已删除的记录
    baseWhere.deleted = db.command.neq(true);

    // convert date filters
    let dateFilters = {};
    if (query.startFrom || query.startTo) {
      dateFilters.startFrom = query.startFrom
        ? new Date(query.startFrom)
        : null;
      dateFilters.startTo = query.startTo ? new Date(query.startTo) : null;
    }
    if (query.endFrom || query.endTo) {
      dateFilters.endFrom = query.endFrom ? new Date(query.endFrom) : null;
      dateFilters.endTo = query.endTo ? new Date(query.endTo) : null;
    }

    // decide ordering
    const orderByField = sortField || "productStart";
    const orderByDirection = sortOrder === "asc" ? "asc" : "desc";

    // helper to apply additional filtering after fetching small page
    function applyDateFilters(item) {
      try {
        if (dateFilters.startFrom && item.productStart) {
          if (new Date(item.productStart) < dateFilters.startFrom) return false;
        }
        if (dateFilters.startTo && item.productStart) {
          if (new Date(item.productStart) > dateFilters.startTo) return false;
        }
        if (dateFilters.endFrom && item.productEnd) {
          if (new Date(item.productEnd) < dateFilters.endFrom) return false;
        }
        if (dateFilters.endTo && item.productEnd) {
          if (new Date(item.productEnd) > dateFilters.endTo) return false;
        }
      } catch (e) {
        return false;
      }
      return true;
    }

    // If request has admin token and is admin, allow paginated detailed list
    if (admin) {
      const skip = Math.max(0, page - 1) * pageSize;
      // cloud database doesn't support dynamic orderBy field easily; assume field exists
      const listRes = await db
        .collection("communities")
        .where(baseWhere)
        .orderBy(orderByField, orderByDirection)
        .skip(skip)
        .limit(pageSize)
        .get();

      // apply date filters client-side for correctness and compute remainingDays
      let data = (listRes.data || []).filter(applyDateFilters).map((c) => {
        const start = c.productStart ? new Date(c.productStart) : null;
        const end = c.productEnd ? new Date(c.productEnd) : null;
        let remainingDays = null;
        if (start && end) {
          const ms = end.getTime() - start.getTime();
          remainingDays = Math.ceil(ms / (24 * 3600 * 1000));
        }
        return Object.assign({}, c, { remainingDays });
      });

      const countRes = await db
        .collection("communities")
        .where(baseWhere)
        .count();
      return {
        success: true,
        data,
        total: countRes.total || 0,
      };
    }

    // Public listing (no auth): return basic info for selection (limit 200)
    const listRes = await db
      .collection("communities")
      .where(baseWhere)
      .orderBy(orderByField, orderByDirection)
      .limit(200)
      .get();

    const data = listRes.data || [];
    const out = [];
    for (const c of data) {
      let adminCount = 0;
      try {
        const cnt = await db
          .collection("users")
          .where({ role: "community", communityId: c._id })
          .count();
        adminCount = cnt.total || 0;
      } catch (e) {
        adminCount = 0;
      }
      out.push({
        _id: c._id,
        name: c.name,
        region: c.region || [],
        adminCount,
        maxAdmins: c.maxAdmins || 10,
        ownerName: c.ownerName || null,
        ownerPhone: c.ownerPhone || null,
      });
    }

    return { success: true, data: out, total: out.length };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
