const { db } = require("../config/db");
const { getTokenFromReq } = require("../utils/helpers");

/**
 * 验证管理员身份
 */
async function ensureAdmin(token) {
  if (!token) {
    return null;
  }
  const res = await db.collection("users").where({ token }).limit(1).get();
  if (res && res.data && res.data.length > 0) {
    const u = res.data[0];
    if (
      u.role === "super" ||
      u.role === "community" ||
      u.role === "community_admin" ||
      u.role === "admin"
    )
      return u;
  }
  return null;
}

/**
 * 认证中间件 - 验证请求是否携带有效的管理员 token
 */
async function authMiddleware(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) {
    return res.status(401).json({ success: false, error: "no_token" });
  }

  const user = await ensureAdmin(token);
  if (!user) {
    return res.status(401).json({ success: false, error: "invalid_token" });
  }

  // 将用户信息附加到 req 对象上，供后续路由使用
  req.user = user;
  next();
}

/**
 * 超级管理员权限中间件 - 只允许超级管理员访问
 */
async function superAdminOnly(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) {
    return res.status(401).json({ success: false, error: "no_token" });
  }

  const user = await ensureAdmin(token);
  if (!user) {
    return res.status(401).json({ success: false, error: "invalid_token" });
  }

  // 检查是否为超级管理员
  if (user.role !== "super") {
    return res
      .status(403)
      .json({ success: false, error: "insufficient_permissions" });
  }

  req.user = user;
  next();
}

module.exports = {
  ensureAdmin,
  authMiddleware,
  superAdminOnly,
  verifyToken: authMiddleware, // 别名，保持兼容性
};
