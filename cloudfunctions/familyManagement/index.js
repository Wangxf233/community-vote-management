// 家属管理云函数
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 家属管理云函数
 * 支持的操作:
 * - apply: 申请成为家属
 * - list: 获取家属列表
 * - approve: 户主批准家属
 * - reject: 户主拒绝家属
 * - unbind: 户主解绑家属
 */
exports.main = async (event, context) => {
  const { action, familyBindingId, rejectReason } = event;
  const wxContext = cloud.getWXContext();
  const userOpenid = wxContext.OPENID;

  if (!userOpenid) {
    return { success: false, error: "unauthorized" };
  }

  try {
    switch (action) {
      case "apply":
        return await applyFamily(event, userOpenid);
      case "list":
        return await listFamily(event, userOpenid);
      case "approve":
        return await approveFamily(familyBindingId, userOpenid);
      case "reject":
        return await rejectFamily(familyBindingId, rejectReason, userOpenid);
      case "unbind":
        return await unbindFamily(familyBindingId, userOpenid);
      default:
        return { success: false, error: "invalid_action" };
    }
  } catch (err) {
    console.error("familyManagement error:", err);
    return {
      success: false,
      error: err.message || "服务器错误",
    };
  }
};

// 申请成为家属
async function applyFamily(event, familyOpenid) {
  const {
    phone,
    name,
    communityName,
    communityId,
    building,
    unit,
    room,
    relation,
    ownerOpenid,
    ownerName,
  } = event;

  // 验证必填字段
  if (
    !phone ||
    !name ||
    !communityName ||
    !building ||
    !unit ||
    !room ||
    !relation ||
    !ownerOpenid
  ) {
    return { success: false, error: "missing_required_fields" };
  }

  // 查找户主的认证记录
  const ownerCertRes = await db
    .collection("certification_applications")
    .where({
      openid: ownerOpenid,
      communityName,
      building,
      unit,
      room,
      type: "owner",
      status: "approved",
    })
    .limit(1)
    .get();

  if (!ownerCertRes.data || ownerCertRes.data.length === 0) {
    return { success: false, error: "owner_not_found" };
  }

  const ownerCert = ownerCertRes.data[0];

  // 检查是否已有申请
  const existingRes = await db
    .collection("certification_applications")
    .where({
      openid: familyOpenid,
      communityName,
      building,
      unit,
      room,
      type: "family",
      status: _.in(["pending", "approved"]),
    })
    .limit(1)
    .get();

  if (existingRes.data && existingRes.data.length > 0) {
    return { success: false, error: "already_applied" };
  }

  // 创建家属认证记录
  const familyCert = {
    openid: familyOpenid,
    communityId: communityId || ownerCert.communityId,
    communityName,
    phone,
    name,
    region: ownerCert.region || [],
    building,
    unit,
    room,
    type: "family",
    relation,
    ownerOpenid,
    ownerName: ownerName || ownerCert.name,
    ownerApprovalStatus: "pending", // 等待户主审核
    status: "pending", // 等待管理员最终审核
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const addRes = await db
    .collection("certification_applications")
    .add({ data: familyCert });

  return {
    success: true,
    certId: addRes._id,
    message: "申请已提交，请等待户主审核",
  };
}

// 获取家属列表
async function listFamily(event, ownerOpenid) {
  // 查找当前用户作为户主的所有认证记录
  const ownerCertRes = await db
    .collection("certification_applications")
    .where({
      openid: ownerOpenid,
      type: "owner",
      status: "approved",
    })
    .get();

  if (!ownerCertRes.data || ownerCertRes.data.length === 0) {
    return {
      success: true,
      pending: [],
      approved: [],
      rejected: [],
      total: 0,
    };
  }

  // 查找所有关联的家属
  const familyRes = await db
    .collection("certification_applications")
    .where({
      ownerOpenid,
      type: "family",
    })
    .get();

  const familyList = familyRes.data || [];

  // 分类
  const pending = familyList.filter((f) => f.ownerApprovalStatus === "pending");
  const approved = familyList.filter(
    (f) => f.ownerApprovalStatus === "approved" && f.status === "approved"
  );
  const rejected = familyList.filter(
    (f) => f.ownerApprovalStatus === "rejected"
  );

  return {
    success: true,
    pending,
    approved,
    rejected,
    total: familyList.length,
  };
}

// 户主批准家属
async function approveFamily(familyBindingId, ownerOpenid) {
  if (!familyBindingId) {
    return { success: false, error: "missing_cert_id" };
  }

  // 查找家属认证记录
  const familyRes = await db
    .collection("certification_applications")
    .doc(familyBindingId)
    .get();

  if (!familyRes.data) {
    return { success: false, error: "cert_not_found" };
  }

  const familyCert = familyRes.data;

  // 验证是否有权限审核
  if (familyCert.ownerOpenid !== ownerOpenid) {
    return { success: false, error: "permission_denied" };
  }

  // 更新状态
  await db
    .collection("certification_applications")
    .doc(familyBindingId)
    .update({
      data: {
        ownerApprovalStatus: "approved",
        ownerApprovalTime: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

  return {
    success: true,
    message: "已批准，等待管理员最终审核",
  };
}

// 户主拒绝家属
async function rejectFamily(familyBindingId, rejectReason, ownerOpenid) {
  if (!familyBindingId) {
    return { success: false, error: "missing_cert_id" };
  }

  // 查找家属认证记录
  const familyRes = await db
    .collection("certification_applications")
    .doc(familyBindingId)
    .get();

  if (!familyRes.data) {
    return { success: false, error: "cert_not_found" };
  }

  const familyCert = familyRes.data;

  // 验证是否有权限审核
  if (familyCert.ownerOpenid !== ownerOpenid) {
    return { success: false, error: "permission_denied" };
  }

  // 更新状态
  await db
    .collection("certification_applications")
    .doc(familyBindingId)
    .update({
      data: {
        ownerApprovalStatus: "rejected",
        ownerRejectReason: rejectReason || "户主拒绝",
        ownerApprovalTime: new Date().toISOString(),
        status: "rejected",
        updatedAt: new Date().toISOString(),
      },
    });

  return {
    success: true,
    message: "已拒绝该家属申请",
  };
}

// 户主解绑家属
async function unbindFamily(familyBindingId, ownerOpenid) {
  if (!familyBindingId) {
    return { success: false, error: "missing_cert_id" };
  }

  // 查找家属认证记录
  const familyRes = await db
    .collection("certification_applications")
    .doc(familyBindingId)
    .get();

  if (!familyRes.data) {
    return { success: false, error: "cert_not_found" };
  }

  const familyCert = familyRes.data;

  // 验证是否有权限解绑
  if (familyCert.ownerOpenid !== ownerOpenid) {
    return { success: false, error: "permission_denied" };
  }

  // 标记为已移除（不直接删除，保留记录）
  await db
    .collection("certification_applications")
    .doc(familyBindingId)
    .update({
      data: {
        status: "removed",
        removedBy: "owner",
        removedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

  return {
    success: true,
    message: "已解绑该家属",
  };
}
