const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 移出家庭成员
 * 将家属的认证状态改为rejected，这样他们再次进入时需要重新认证
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { certificationId } = event;

  try {
    if (!certificationId) {
      return {
        success: false,
        error: "缺少认证ID",
      };
    }

    // 1. 获取当前用户的认证信息（户主）
    const ownerResult = await db
      .collection("certification_applications")
      .where({
        openid: openid,
        status: "approved",
        type: "owner",
      })
      .limit(1)
      .get();

    if (!ownerResult.data || ownerResult.data.length === 0) {
      return {
        success: false,
        error: "您不是户主，无权移出成员",
      };
    }

    const ownerData = ownerResult.data[0];

    // 2. 获取要移出的家属信息
    const familyResult = await db
      .collection("certification_applications")
      .doc(certificationId)
      .get();

    if (!familyResult.data) {
      return {
        success: false,
        error: "未找到该成员信息",
      };
    }

    const familyData = familyResult.data;

    // 3. 验证是否是该户主的家属
    if (
      familyData.ownerOpenid !== openid ||
      familyData.type !== "family" ||
      familyData.status !== "approved"
    ) {
      return {
        success: false,
        error: "该成员不是您的家属或已被移出",
      };
    }

    // 4. 将家属的认证状态改为removed（移出状态）
    await db
      .collection("certification_applications")
      .doc(certificationId)
      .update({
        data: {
          status: "removed",
          removedAt: new Date(),
          removedBy: openid,
          updatedAt: new Date(),
        },
      });

    return {
      success: true,
      message: "移出成功",
    };
  } catch (err) {
    console.error("移出家庭成员失败:", err);
    return {
      success: false,
      error: err.message || "移出失败",
    };
  }
};
