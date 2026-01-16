const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();
const crypto = require("crypto");

exports.main = async (event, context) => {
  try {
    const { adminToken, adminId, username, newPassword, reset } = event || {};
    // 注意：token 验证已在 server.js 中完成

    if (!adminId) {
      return { success: false, error: "missing adminId" };
    }

    const updates = { updatedAt: new Date() };

    // 更新用户名
    if (username && username.trim()) {
      // 检查用户名是否被占用
      const existRes = await db
        .collection("users")
        .where({ username: username.trim() })
        .limit(1)
        .get();

      if (existRes && existRes.data && existRes.data.length > 0) {
        const existing = existRes.data[0];
        if (existing._id !== adminId) {
          return { success: false, error: "username_exists" };
        }
      }

      updates.username = username.trim();
    }

    // 重置或设置密码
    if (newPassword) {
      const passwordHash = crypto
        .createHash("sha256")
        .update(newPassword)
        .digest("hex");
      updates.passwordHash = passwordHash;

      // 如果是重置密码，清除强制修改密码标志
      if (reset) {
        updates.mustChangePassword = false;
      }
    }

    await db.collection("users").doc(adminId).update({ data: updates });

    return {
      success: true,
      newPassword: newPassword || undefined,
    };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
