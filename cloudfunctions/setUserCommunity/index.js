const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * setUserCommunity
 * 记录用户当前使用的小区（切换小区时调用）
 * 存 user_preferences 集合（_id = openid，一条一用户），本地缓存被清除后仍可恢复小区状态
 *
 * 说明：
 * 1. 不写 users 集合 —— users 上有 username 唯一索引，
 *    无 username 的小程序用户新增记录会触发 E11000 duplicate key error。
 * 2. CloudBase 集合在首次【写入(add)】时自动创建；对不存在的集合执行 get 会抛
 *    DATABASE_COLLECTION_NOT_EXIST，而对不存在的文档执行 update 可能【静默成功但不写入】。
 *    因此流程为：get（容错）→ 有记录 update / 无记录 add → 回读校验，确保写入真实生效。
 * 3. 使用确定性 _id = openid，并发/重复调用安全。
 *
 * 入参:
 * - communityId: 小区ID
 *
 * 返回:
 * - { success: true }
 */
exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { communityId } = event || {};

    if (!openid) {
      return { success: false, error: "未获取到用户身份" };
    }
    if (!communityId) {
      return { success: false, error: "缺少小区ID" };
    }

    const now = new Date().toISOString();

    // 1. 查询已有记录（集合不存在等异常按"无记录"处理）
    let existing = null;
    try {
      const prefRes = await db
        .collection("user_preferences")
        .where({ openid })
        .limit(1)
        .get();
      existing =
        prefRes.data && prefRes.data.length > 0 ? prefRes.data[0] : null;
    } catch (getErr) {
      console.warn(
        "setUserCommunity: 查询 user_preferences 失败，按无记录处理:",
        getErr.message,
      );
    }

    // 2. 已有记录：更新
    if (existing) {
      await db
        .collection("user_preferences")
        .doc(existing._id)
        .update({
          data: {
            currentCommunityId: communityId,
            updatedAt: now,
          },
        });
    } else {
      // 3. 无记录：新增（首次写入自动创建集合；确定性 _id 防重复）
      try {
        await db.collection("user_preferences").add({
          data: {
            _id: openid,
            openid,
            currentCommunityId: communityId,
            createdAt: now,
            updatedAt: now,
          },
        });
      } catch (addErr) {
        // 并发下记录已被其他请求创建：改走更新
        await db
          .collection("user_preferences")
          .doc(openid)
          .update({
            data: {
              currentCommunityId: communityId,
              updatedAt: now,
            },
          });
      }
    }

    // 4. 回读校验，确保确实写入成功（避免 update 静默无效的情况）
    try {
      const verifyRes = await db
        .collection("user_preferences")
        .doc(openid)
        .get();
      const saved = verifyRes.data && verifyRes.data.currentCommunityId;
      if (saved === communityId) {
        return { success: true };
      }
      console.error(
        "setUserCommunity 回读校验失败:",
        JSON.stringify(verifyRes.data || null),
      );
      return { success: false, error: "回读校验失败，请重试" };
    } catch (verifyErr) {
      console.error("setUserCommunity 回读失败:", verifyErr.message);
      return { success: false, error: verifyErr.message || "回读失败" };
    }
  } catch (err) {
    console.error("setUserCommunity error:", err);
    return { success: false, error: err.message || "记录失败" };
  }
};
