/**
 * 数据库迁移脚本 - 为现有小区数据添加新字段
 * 运行方式：在云开发控制台的云函数中创建并执行此函数
 */
const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    console.log("开始数据库迁移...");

    // 获取所有小区数据
    const res = await db.collection("communities").get();
    const communities = res.data || [];

    console.log(`找到 ${communities.length} 个小区记录`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const community of communities) {
      const needsUpdate = {};

      // 检查并添加 address 字段
      if (!community.hasOwnProperty("address")) {
        needsUpdate.address = "";
      }

      // 检查并添加 deleted 字段
      if (!community.hasOwnProperty("deleted")) {
        needsUpdate.deleted = false;
      }

      // 检查并添加 deletedAt 字段
      if (!community.hasOwnProperty("deletedAt")) {
        needsUpdate.deletedAt = null;
      }

      // 如果有需要更新的字段
      if (Object.keys(needsUpdate).length > 0) {
        try {
          await db.collection("communities").doc(community._id).update({
            data: needsUpdate,
          });
          console.log(
            `更新小区: ${community.name} (ID: ${community._id})`,
            needsUpdate,
          );
          updatedCount++;
        } catch (err) {
          console.error(`更新小区 ${community.name} 失败:`, err.message || err);
        }
      } else {
        console.log(`跳过小区: ${community.name} (已有所有必需字段)`);
        skippedCount++;
      }
    }

    const summary = {
      success: true,
      total: communities.length,
      updated: updatedCount,
      skipped: skippedCount,
      message: `迁移完成: 总计 ${communities.length} 条记录, 更新 ${updatedCount} 条, 跳过 ${skippedCount} 条`,
    };

    console.log("迁移完成:", summary);
    return summary;
  } catch (e) {
    console.error("迁移失败:", e);
    return {
      success: false,
      error: e.message || String(e),
    };
  }
};
