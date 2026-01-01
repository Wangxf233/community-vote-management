// 检查 votes 集合数据结构的脚本
// 在云开发控制台的云函数中运行此代码，或者创建一个临时云函数

const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    // 获取所有投票记录
    const votesRes = await db.collection("votes").limit(10).get();

    console.log("投票记录数量:", votesRes.data.length);

    votesRes.data.forEach((vote, index) => {
      console.log(`\n=== 投票 ${index + 1} ===`);
      console.log("ID:", vote._id);
      console.log("标题:", vote.title);
      console.log("状态:", vote.status);
      console.log(
        "选项字段名:",
        Object.keys(vote).filter(
          (key) =>
            key.toLowerCase().includes("option") ||
            key === "choices" ||
            key === "items"
        )
      );

      // 检查各种可能的选项字段
      if (vote.options) {
        console.log("options 字段:", JSON.stringify(vote.options, null, 2));
      }
      if (vote.option) {
        console.log("option 字段:", JSON.stringify(vote.option, null, 2));
      }
      if (vote.voteOptions) {
        console.log(
          "voteOptions 字段:",
          JSON.stringify(vote.voteOptions, null, 2)
        );
      }
      if (vote.choices) {
        console.log("choices 字段:", JSON.stringify(vote.choices, null, 2));
      }

      console.log("所有字段:", Object.keys(vote));
    });

    return {
      success: true,
      message: "检查完成，请查看云函数日志",
    };
  } catch (err) {
    console.error("检查失败:", err);
    return {
      success: false,
      error: err.message,
    };
  }
};
