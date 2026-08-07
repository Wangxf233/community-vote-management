const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * generateInviteCode
 * 户主生成家属邀请码
 *
 * 返回:
 * - inviteCode: 8位邀请码
 * - expiresAt: 过期时间（7天后）
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { communityId } = event;

    if (!openid) {
      return { code: -1, message: "无法获取用户身份" };
    }

    if (!communityId) {
      return { code: -1, message: "无法确定当前小区，请先切换小区" };
    }

    // 验证当前用户是否为该小区的已认证户主
    const ownerRes = await db
      .collection("certification_applications")
      .where({
        openid,
        type: "owner",
        status: "approved",
        communityId,
      })
      .limit(1)
      .get();

    if (!ownerRes.data || ownerRes.data.length === 0) {
      return { code: -1, message: "只有已认证的户主才能生成邀请码" };
    }

    const owner = ownerRes.data[0];

    // 检查是否已有有效的邀请码（未过期且未使用）
    const now = new Date();
    const forceNew = event.forceNew || false; // 是否强制生成新的邀请码

    const existingCodeRes = await db
      .collection("family_invite_codes")
      .where({
        ownerOpenid: openid,
        status: "active",
      })
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (existingCodeRes.data && existingCodeRes.data.length > 0) {
      const existingCode = existingCodeRes.data[0];
      const expiresAt = new Date(existingCode.expiresAt);

      // 如果邀请码还在有效期内
      if (expiresAt > now) {
        // 如果不是强制生成新的，直接返回现有邀请码
        if (!forceNew) {
          return {
            code: 0,
            data: {
              inviteCode: existingCode.code,
              expiresAt: existingCode.expiresAt,
              isExisting: true,
            },
          };
        } else {
          // 强制生成新的，将旧邀请码标记为过期
          await db
            .collection("family_invite_codes")
            .doc(existingCode._id)
            .update({
              data: {
                status: "expired",
                updatedAt: now.toISOString(),
              },
            });
        }
      }
    }

    // 生成8位随机邀请码
    const generateCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉容易混淆的字符
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let inviteCode = generateCode();

    // 确保邀请码唯一
    let attempts = 0;
    while (attempts < 10) {
      const existingRes = await db
        .collection("family_invite_codes")
        .where({ code: inviteCode })
        .limit(1)
        .get();

      if (!existingRes.data || existingRes.data.length === 0) {
        break;
      }

      inviteCode = generateCode();
      attempts++;
    }

    if (attempts >= 10) {
      return { code: -1, message: "生成邀请码失败，请重试" };
    }

    // 设置过期时间（7天后）
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 保存邀请码
    await db.collection("family_invite_codes").add({
      data: {
        code: inviteCode,
        ownerOpenid: openid,
        ownerName: owner.name,
        communityId: owner.communityId,
        communityName: owner.communityName,
        building: owner.building,
        unit: owner.unit,
        room: owner.room,
        status: "active",
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        updatedAt: now.toISOString(),
      },
    });

    return {
      code: 0,
      data: {
        inviteCode,
        expiresAt: expiresAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("generateInviteCode error:", error);
    return { code: -1, message: error.message || "生成邀请码失败" };
  }
};
