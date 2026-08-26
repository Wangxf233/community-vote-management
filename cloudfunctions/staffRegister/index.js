const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 工作人员注册
 * 接收：communityId, name, phone, position
 * 写入 staff 集合，状态默认 pending
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { communityId, name, phone, position } = event;

  try {
    // 参数校验
    if (!communityId) {
      return { success: false, error: "缺少小区ID" };
    }
    if (!name || !name.trim()) {
      return { success: false, error: "姓名不能为空" };
    }
    if (!phone || !phone.trim()) {
      return { success: false, error: "手机号不能为空" };
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return { success: false, error: "手机号格式不正确" };
    }

    // 如果 communityId 不是标准的 CloudBase _id 格式，尝试当作小区名称去查找真正的 _id
    let resolvedCommunityId = communityId;
    if (communityId.length < 20) {
      const commResult = await db
        .collection("communities")
        .where({ name: communityId })
        .limit(1)
        .get();
      if (commResult.data && commResult.data.length > 0) {
        resolvedCommunityId = commResult.data[0]._id;
      } else {
        return { success: false, error: "小区不存在，请重新选择" };
      }
    } else {
      // _id 格式：校验小区真实存在，防止写入无效小区ID
      const exists = await db
        .collection("communities")
        .doc(resolvedCommunityId)
        .get()
        .catch(() => null);
      if (!exists || !exists.data) {
        return { success: false, error: "小区不存在，请重新选择" };
      }
    }

    const now = new Date().toISOString();

    const result = await db.collection("staff").add({
      data: {
        communityId: resolvedCommunityId,
        name: name.trim(),
        phone: phone.trim(),
        position: position || "",
        status: "pending",
        openid,
        createTime: now,
        updateTime: now,
      },
    });

    return {
      success: true,
      data: { _id: result._id },
      message: "注册成功，请等待管理员审核",
    };
  } catch (err) {
    console.error("staffRegister error:", err);
    return { success: false, error: err.message || "注册失败" };
  }
};
