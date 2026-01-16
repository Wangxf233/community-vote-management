const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();
const crypto = require("crypto");

exports.main = async (event, context) => {
  try {
    const { adminToken, communityId, admin } = event || {};
    // 注意：token 验证已在 server.js 中完成

    if (!communityId || !admin) {
      return { success: false, error: "missing params" };
    }

    // 验证必填字段
    if (!admin.username || !admin.password || !admin.name || !admin.phone) {
      return { success: false, error: "missing required fields" };
    }

    // 检查用户名是否已存在
    const existRes = await db
      .collection("users")
      .where({ username: admin.username })
      .limit(1)
      .get();

    if (existRes && existRes.data && existRes.data.length > 0) {
      return { success: false, error: "username_exists" };
    }

    // 加密密码
    const passwordHash = crypto
      .createHash("sha256")
      .update(admin.password)
      .digest("hex");

    // 创建管理员
    const now = new Date();
    const newAdmin = {
      username: admin.username,
      passwordHash,
      name: admin.name,
      phone: admin.phone,
      department: admin.department || "", // 所属部门
      position: admin.position || "管理员",
      role: "community_admin", // 小区普通管理员
      communityId,
      permissions: admin.permissions || [], // 权限数组
      isPrimaryAdmin: false, // 非总管理员
      mustChangePassword: true, // 首次登录强制修改密码
      createdAt: now,
      updatedAt: now,
    };

    const addRes = await db.collection("users").add({ data: newAdmin });

    return {
      success: true,
      id: addRes._id,
      username: admin.username,
    };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
