const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * validateToken
 * - Accepts { token } to validate a session token
 * - If no token provided, resolves current user by cloud.getWXContext().OPENID
 * - Returns { valid: boolean, userInfo?: { _id, nickname, avatarUrl } }
 */
exports.main = async (event, context) => {
  const token =
    (event && (event.token || (event.data && event.data.token))) || "";
  try {
    // If token provided, lookup by token
    if (token) {
      if (token === "invalid") return { valid: false };
      const q = await db.collection("users").where({ token }).limit(1).get();
      if (q && q.data && q.data.length > 0) {
        const user = q.data[0];
        return {
          valid: true,
          userInfo: {
            _id: user._id,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
          },
        };
      }
      return { valid: false };
    }

    // Otherwise, try resolving by openid
    const wxContext = cloud.getWXContext();
    const openid = wxContext && wxContext.OPENID;
    if (!openid) return { valid: false };

    const q2 = await db.collection("users").where({ openid }).limit(1).get();
    if (q2 && q2.data && q2.data.length > 0) {
      const user = q2.data[0];
      return {
        valid: true,
        userInfo: {
          _id: user._id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
        },
      };
    }

    return { valid: false };
  } catch (err) {
    console.error("validateToken error", err);
    return { valid: false, error: err && err.message };
  }
};
