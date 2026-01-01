/**
 * 从请求中提取 Bearer token 或 query token
 */
function getTokenFromReq(req) {
  try {
    const h = req.header ? req.header("authorization") : null;
    if (h && typeof h === "string" && h.toLowerCase().startsWith("bearer ")) {
      return h.replace(/^[Bb]earer\s+/, "");
    }
    return (req.query && (req.query.adminToken || req.query.token)) || null;
  } catch (_) {
    return null;
  }
}

/**
 * 规范化楼栋号（移除"栋"、"幢"后缀）
 */
function normalizeBuilding(str) {
  return String(str)
    .replace(/[栋幢]/g, "")
    .trim();
}

/**
 * 规范化单元号（移除"单元"后缀）
 */
function normalizeUnit(str) {
  return String(str)
    .replace(/[单元]/g, "")
    .trim();
}

/**
 * 规范化房号
 */
function normalizeRoom(str) {
  return String(str).trim();
}

module.exports = {
  getTokenFromReq,
  normalizeBuilding,
  normalizeUnit,
  normalizeRoom,
};
