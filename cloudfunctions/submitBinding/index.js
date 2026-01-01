const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * submitBinding implementation with enhanced fields:
 * - phone number
 * - name
 * - residential/commercial/parking area
 * - car number
 * - userType: 'owner' or 'family'
 * - realName: 实名认证姓名
 * - idCard: 身份证号(脱敏)
 * - proofImages: 房产证明图片数组
 * - householdRelation: 家属关系
 * - ownerOpenid: 家属关联的户主openid
 */
exports.main = async (event, context) => {
  try {
    const {
      openid,
      phone,
      name,
      region,
      communityName,
      building,
      block,
      room,
      residentialArea,
      commercialArea,
      parkingArea,
      carNumber,
      userType,
      realName,
      idCard,
      proofImages,
      householdRelation,
      ownerOpenid,
    } = event;

    // 必填字段验证
    if (!phone || !name) {
      return { success: false, error: "phone和name必填" };
    }

    // 根据用户类型验证不同字段
    if (userType === "owner") {
      if (!realName) {
        return { success: false, error: "户主必须完成实名认证" };
      }
      if (!proofImages || proofImages.length === 0) {
        return { success: false, error: "户主必须上传房产证明" };
      }
    } else if (userType === "family") {
      if (!householdRelation) {
        return { success: false, error: "家属必须填写与户主关系" };
      }
      if (!ownerOpenid) {
        return { success: false, error: "家属必须关联户主" };
      }
    }
    if (!Array.isArray(region) || region.length !== 3) {
      return { success: false, error: "region必须为省市区数组" };
    }
    if (!communityName || !building || !block || !room) {
      return { success: false, error: "communityName/building/block/room必填" };
    }

    const wxContext = cloud.getWXContext();
    const userOpenid = openid || wxContext.OPENID;

    if (!userOpenid) {
      return { success: false, error: "无法识别用户身份" };
    }

    // 检查是否已有待审核的绑定
    const existing = await db
      .collection("bindings")
      .where({
        openid: userOpenid,
        status: "pending",
      })
      .get();

    if (existing && existing.data && existing.data.length > 0) {
      return {
        success: false,
        error: "已存在待审核的绑定",
        bindingId: existing.data[0]._id,
      };
    }

    // 尝试解析社区ID
    let communityId = null;
    try {
      const q = await db
        .collection("communities")
        .where({ name: communityName })
        .limit(1)
        .get();
      if (q && q.data && q.data.length > 0) {
        communityId = q.data[0]._id;
      }
    } catch (e) {
      console.warn("check community failed", e.message);
    }

    // 构建绑定记录
    const payload = {
      openid: userOpenid,
      communityId: communityId || null,
      communityName,
      phone,
      name,
      region,
      building,
      block,
      room,
      residentialArea: parseFloat(residentialArea) || 0,
      commercialArea: parseFloat(commercialArea) || 0,
      parkingArea: parseFloat(parkingArea) || 0,
      carNumber: carNumber || "",
      userType: userType || "owner", // 默认为户主
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 户主特有字段
    if (userType === "owner") {
      payload.realName = realName || "";
      payload.idCard = idCard || "";
      payload.idCardVerified = !!realName; // 是否完成实名认证
      payload.proofImages = proofImages || [];
    }

    // 家属特有字段
    if (userType === "family") {
      payload.householdRelation = householdRelation || "";
      payload.ownerOpenid = ownerOpenid || "";
      payload.ownerApprovalStatus = "pending"; // 等待户主审核
    }

    const addRes = await db.collection("bindings").add({ data: payload });
    const bindingId = addRes._id;

    return {
      success: true,
      bindingId,
      status: "pending",
    };
  } catch (err) {
    console.error("submitBinding error", err);
    return {
      success: false,
      error: err.message || "服务器错误",
    };
  }
};
