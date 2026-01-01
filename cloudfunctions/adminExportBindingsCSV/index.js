const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

function toCsvRow(arr) {
  return arr
    .map((v) => {
      if (v === undefined || v === null) return "";
      const s = String(v);
      // 如果包含逗号或双引号或换行，包裹并转义双引号
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    })
    .join(",");
}

exports.main = async (event, context) => {
  try {
    const { adminToken, filters } = event || {};
    // 注意：token 验证已在 server.js 中完成，此处不再重复验证

    const q = {};
    if (filters) {
      if (filters.status) q.status = filters.status;
      if (filters.communityName)
        q.communityName = db.RegExp({
          regexp: filters.communityName,
          options: "i",
        });
      if (filters.fromDate || filters.toDate) {
        const range = {};
        if (filters.fromDate) range.$gte = new Date(filters.fromDate);
        if (filters.toDate) range.$lte = new Date(filters.toDate);
        q.submittedAt = range;
      }
    }

    // 为了避免超出云函数返回限制，限制导出最大条数（例如 5000）
    const MAX = 5000;
    const listRes = await db
      .collection("bindings")
      .where(q)
      .orderBy("submittedAt", "desc")
      .limit(MAX)
      .get();
    const rows = listRes.data || [];

    const header = [
      "bindingId",
      "userOpenid",
      "communityName",
      "region",
      "building",
      "block",
      "room",
      "status",
      "submittedAt",
      "reviewedAt",
      "failReason",
    ];
    const lines = [toCsvRow(header)];
    for (const r of rows) {
      const line = [
        r._id || "",
        r.userOpenid || r.openid || "",
        r.communityName || "",
        Array.isArray(r.region) ? r.region.join(" / ") : r.region || "",
        r.building || "",
        r.block || "",
        r.room || "",
        r.status || "",
        r.submittedAt ? new Date(r.submittedAt).toISOString() : "",
        r.reviewedAt ? new Date(r.reviewedAt).toISOString() : "",
        r.failReason || "",
      ];
      lines.push(toCsvRow(line));
    }

    const csv = lines.join("\n");
    // 返回 CSV 文本（调用方可根据需要保存为文件）
    return { success: true, csv, count: rows.length };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
