const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();
const _ = db.command;

/**
 * 定时清理已删除超过30天的小区数据
 * 建议配置为每天凌晨执行一次
 */
exports.main = async (event, context) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    console.log("开始清理已删除超过30天的小区数据...");
    console.log("当前时间:", now.toISOString());
    console.log("30天前时间:", thirtyDaysAgo.toISOString());

    // 查找已删除且deletedAt在30天前的小区
    const communitiesRes = await db
      .collection("communities")
      .where({
        deleted: true,
        deletedAt: _.lte(thirtyDaysAgo),
      })
      .get();

    const communities = communitiesRes.data || [];
    console.log(`找到 ${communities.length} 个需要清理的小区`);

    if (communities.length === 0) {
      return {
        success: true,
        message: "没有需要清理的小区",
        deleted: 0,
      };
    }

    let deletedCount = 0;
    let deletedUserCount = 0;

    // 遍历每个小区进行清理
    for (const community of communities) {
      const communityId = community._id;
      console.log(`清理小区: ${community.name} (ID: ${communityId})`);

      try {
        // 删除该小区的所有管理员账号
        const usersRes = await db
          .collection("users")
          .where({
            communityId: communityId,
            role: "community",
          })
          .get();

        if (usersRes.data && usersRes.data.length > 0) {
          const deleteUserPromises = usersRes.data.map((user) =>
            db.collection("users").doc(user._id).remove(),
          );
          await Promise.all(deleteUserPromises);
          deletedUserCount += usersRes.data.length;
          console.log(`  删除了 ${usersRes.data.length} 个管理员账号`);
        }

        // 删除小区记录
        await db.collection("communities").doc(communityId).remove();
        deletedCount++;
        console.log(`  小区已彻底删除`);
      } catch (err) {
        console.error(`清理小区 ${communityId} 失败:`, err);
      }
    }

    console.log("清理完成");
    console.log(
      `总计删除: ${deletedCount} 个小区, ${deletedUserCount} 个管理员账号`,
    );

    return {
      success: true,
      message: `成功清理 ${deletedCount} 个小区和 ${deletedUserCount} 个管理员账号`,
      deleted: deletedCount,
      deletedUsers: deletedUserCount,
      timestamp: now.toISOString(),
    };
  } catch (e) {
    console.error("清理任务执行失败:", e);
    return {
      success: false,
      error: e.message || String(e),
    };
  }
};
