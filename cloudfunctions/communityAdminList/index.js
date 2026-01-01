const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const {
      adminToken,
      communityId,
      page = 1,
      pageSize = 50,
      department,
      position,
      name,
      phone,
      username,
    } = event || {};
    // 注意：token 验证已在 server.js 中完成

    if (!communityId) {
      return { success: false, error: "missing communityId" };
    }

    // 查询该小区的所有普通管理员（不包括总管理员）
    const query = {
      communityId,
      role: "community_admin",
      isPrimaryAdmin: false,
    };

    // 添加筛选条件（模糊匹配）
    if (department) {
      query.department = db.RegExp({
        regexp: department,
        options: "i",
      });
    }
    if (position) {
      query.position = db.RegExp({
        regexp: position,
        options: "i",
      });
    }
    if (name) {
      query.name = db.RegExp({
        regexp: name,
        options: "i",
      });
    }
    if (phone) {
      query.phone = db.RegExp({
        regexp: phone,
        options: "i",
      });
    }
    if (username) {
      query.username = db.RegExp({
        regexp: username,
        options: "i",
      });
    }

    const skip = Math.max(0, page - 1) * pageSize;
    const listRes = await db
      .collection("users")
      .where(query)
      .orderBy("createdAt", "desc")
      .skip(skip)
      .limit(pageSize)
      .get();

    const countRes = await db.collection("users").where(query).count();

    // 过滤敏感字段
    const data = (listRes.data || []).map((u) => ({
      _id: u._id,
      username: u.username,
      name: u.name,
      phone: u.phone,
      department: u.department || "",
      position: u.position,
      permissions: u.permissions || [],
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return {
      success: true,
      data,
      total: countRes.total || 0,
    };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
