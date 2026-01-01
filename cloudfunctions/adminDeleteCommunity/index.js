const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { adminToken, communityId } = event || {};
    // 注意：token 验证已在 server.js 中完成，此处不再重复验证
    // 因为 wx-server-sdk 和 @cloudbase/node-sdk 连接的是不同的数据库环境

    if (!communityId) return { success: false, error: "missing communityId" };

    // 删除小区
    await db.collection("communities").doc(communityId).remove();

    // 删除该小区的默认管理员账号（isPrimaryAdmin为true的用户）
    const _ = db.command;
    const usersRes = await db
      .collection("users")
      .where({
        communityId: communityId,
        isPrimaryAdmin: true,
      })
      .get();

    // 批量删除找到的默认管理员账号
    if (usersRes.data && usersRes.data.length > 0) {
      const deletePromises = usersRes.data.map((user) =>
        db.collection("users").doc(user._id).remove()
      );
      await Promise.all(deletePromises);
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
