// 云函数入口文件
const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    // 优先查询 owner_list 集合（通过 openid 直接查询）
    const ownerListRes = await db
      .collection("owner_list")
      .where({
        openid: openid,
      })
      .get();

    if (ownerListRes.data.length > 0) {
      // 从 owner_list 获取实名认证状态
      const owner = ownerListRes.data[0];
      const realNameStatus = owner.realNameStatus || "unverified";
      const rejectReason = owner.realNameRejectReason || "";

      return {
        success: true,
        data: {
          status: realNameStatus,
          reason: rejectReason,
        },
      };
    }

    // 如果 owner_list 没有数据，尝试查询 certification_applications 和 owner_registry
    const certAppRes = await db
      .collection("certification_applications")
      .where({
        openid: openid,
        type: "owner",
      })
      .orderBy("submitTime", "desc")
      .limit(1)
      .get();

    let ownerId = null;

    if (certAppRes.data.length > 0) {
      const certApp = certAppRes.data[0];

      // 如果认证申请还未通过，不能进行实名认证
      if (certApp.status !== "approved") {
        return {
          success: false,
          message: "户主认证尚未通过，请先完成户主认证",
        };
      }

      // 已通过认证，使用 ownerId
      ownerId = certApp.ownerId;
    } else {
      // 如果没有找到 certification_applications，尝试查询 bindings 集合（旧系统）
      const bindingRes = await db
        .collection("bindings")
        .where({
          openid: openid,
        })
        .get();

      if (bindingRes.data.length === 0) {
        return {
          success: false,
          message: "未找到绑定信息，请先完成户主认证",
        };
      }

      ownerId = bindingRes.data[0].ownerId;
    }

    // 查询户主的实名认证状态（从 owner_registry）
    const ownerRes = await db
      .collection("owner_registry")
      .where({
        _id: ownerId,
      })
      .get();

    if (ownerRes.data.length === 0) {
      return {
        success: false,
        message: "未找到户主信息",
      };
    }

    const owner = ownerRes.data[0];
    const realNameStatus = owner.realNameStatus || "unverified";
    const rejectReason = owner.realNameRejectReason || "";

    return {
      success: true,
      data: {
        status: realNameStatus, // unverified: 未认证, pending: 审核中, approved: 已通过, rejected: 已拒绝
        reason: rejectReason,
      },
    };
  } catch (err) {
    console.error("验证实名状态失败:", err);
    return {
      success: false,
      message: "验证失败",
    };
  }
};
