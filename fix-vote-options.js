// 修复现有投票记录，添加默认选项
// 在云开发控制台运行此脚本，或创建临时云函数

const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    console.log("开始修复投票记录...");

    // 查找所有没有 options 字段的投票
    const votesRes = await db
      .collection("votes")
      .where({
        options: _.exists(false),
      })
      .get();

    console.log(`找到 ${votesRes.data.length} 条需要修复的记录`);

    const defaultOptions = [
      { id: "option1", text: "同意" },
      { id: "option2", text: "不同意" },
      { id: "option3", text: "弃权" },
    ];

    let successCount = 0;
    let failCount = 0;

    // 逐个更新
    for (const vote of votesRes.data) {
      try {
        await db
          .collection("votes")
          .doc(vote._id)
          .update({
            data: {
              options: defaultOptions,
              optionCounts: vote.optionCounts || {},
              totalVotes: vote.totalVotes || 0,
              updatedAt: new Date(),
            },
          });

        console.log(`✓ 成功修复投票: ${vote.title} (${vote._id})`);
        successCount++;
      } catch (err) {
        console.error(`✗ 修复失败: ${vote.title} (${vote._id})`, err);
        failCount++;
      }
    }

    console.log(`\n修复完成！`);
    console.log(`成功: ${successCount} 条`);
    console.log(`失败: ${failCount} 条`);

    return {
      success: true,
      message: `修复完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      details: {
        total: votesRes.data.length,
        success: successCount,
        fail: failCount,
      },
    };
  } catch (err) {
    console.error("修复脚本执行失败:", err);
    return {
      success: false,
      error: err.message,
    };
  }
};
