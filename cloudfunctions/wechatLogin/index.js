const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * Simplified wechatLogin cloud function
 * - Intended to be called from the mini program (so cloud.getWXContext() has OPENID)
 * - Behaviour:
 *   - Resolve openid via cloud.getWXContext() or event.openid (for testing)
 *   - If user exists in `users` collection: optionally update nickname/avatar (if provided),
 *     and return existing token (unless event.forceNewToken=true then generate a new token)
 *   - If user does not exist: create user document with generated token and return it
 * - Returns: { success: true, token, user: { _id, openid, nickname, avatarUrl } } or { success:false, error }
 */

function genToken() {
  return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

exports.main = async (event, context) => {
  try {
    // support event.mock for quick testing
    if (event && event.mock === "none") {
      return { success: true, token: null, user: null };
    }

    const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
    const openid = (wxContext && wxContext.OPENID) || (event && event.openid);

    if (!openid) {
      return {
        success: false,
        error: "无法解析 openid，请从小程序内调用或提供 event.openid 进行测试",
      };
    }

    const profile = event && event.profile;
    const nickname =
      profile && profile.nickName
        ? profile.nickName
        : (event && event.nickname) || "";
    const avatarUrl =
      profile && profile.avatarUrl
        ? profile.avatarUrl
        : (event && event.avatarUrl) || "";
    const forceNew = event && event.forceNewToken;

    // find existing user by openid
    const q = await db.collection("users").where({ openid }).limit(1).get();
    if (q && q.data && q.data.length > 0) {
      const user = q.data[0];
      const updates = {};
      if (nickname && nickname !== user.nickname) updates.nickname = nickname;
      if (avatarUrl && avatarUrl !== user.avatarUrl)
        updates.avatarUrl = avatarUrl;

      let token = user.token;
      if (!token || forceNew) {
        token = genToken();
        updates.token = token;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = Date.now();
        try {
          await db.collection("users").doc(user._id).update({ data: updates });
        } catch (e) {
          console.warn("wechatLogin: update user failed", e && e.message);
        }
      }

      return {
        success: true,
        token,
        user: {
          _id: user._id,
          openid,
          nickname: updates.nickname || user.nickname,
          avatarUrl: updates.avatarUrl || user.avatarUrl,
        },
      };
    }

    // create new user
    const token = genToken();
    const newUser = {
      openid,
      nickname: nickname || "",
      avatarUrl: avatarUrl || "",
      token,
      role: "user",
      createdAt: Date.now(),
    };
    const addRes = await db.collection("users").add({ data: newUser });
    const _id = addRes && addRes._id;
    return {
      success: true,
      token,
      user: {
        _id,
        openid,
        nickname: newUser.nickname,
        avatarUrl: newUser.avatarUrl,
      },
    };
  } catch (err) {
    console.error("wechatLogin error", err);
    return { success: false, error: err && err.message };
  }
};
