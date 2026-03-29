/**
 * 清理测试投票数据脚本
 */

const tcb = require("@cloudbase/node-sdk");

// 尝试加载 dotenv
try {
  require("dotenv").config({ path: "./admin/.env" });
} catch (e) {
  console.log("提示: 从系统环境变量读取配置\n");
}

// 初始化云开发
const app = tcb.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY,
});

const db = app.database();

// 要清理的投票ID
const VOTE_ID = "743372846969ac140c4d40656692ec81";

async function cleanupTestData() {
  console.log(`\n==================== 清理测试数据 ====================`);
  console.log(`投票ID: ${VOTE_ID}`);
  console.log(`正在删除所有 test_user_ 开头的测试投票记录...\n`);

  try {
    const result = await db
      .collection("vote_records")
      .where({
        voteId: VOTE_ID,
        userId: db.RegExp({
          regexp: "^test_user_",
          options: "i",
        }),
      })
      .remove();

    console.log(`✓ 成功删除 ${result.deleted} 条测试投票记录`);
    console.log(`\n清理完成！\n`);
  } catch (error) {
    console.error(`❌ 清理失败:`, error.message);
  }
}

cleanupTestData().catch((error) => {
  console.error("脚本执行失败:", error);
  process.exit(1);
});
