/**
 * 并发投票测试脚本
 * 用于测试多人同时投票时的系统稳定性和数据准确性
 */

const tcb = require("@cloudbase/node-sdk");

// 尝试加载 dotenv（如果已安装）
try {
  require("dotenv").config({ path: "./admin/.env" });
} catch (e) {
  console.log("提示: dotenv 未安装，将从系统环境变量读取配置");
  console.log("如需从 .env 文件读取，请运行: npm install dotenv\n");
}

// 初始化云开发
const app = tcb.init({
  env: process.env.TCB_ENV_ID,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY,
});

const db = app.database();

// ========== 测试配置 ==========
const TEST_CONFIG = {
  voteId: "743372846969ac140c4d40656692ec81", // 测试的投票ID - 需要先创建一个测试投票，然后填入这里
  communityId: "743372846922808f04a9f7da5e93ea64", // 社区ID - 需要填入实际的社区ID
  concurrentUsers: 20, // 并发用户数
  testRounds: 3, // 测试轮数
  delayBetweenRounds: 2000, // 每轮之间的延迟（毫秒）
};

// 模拟投票选项
const VOTE_OPTIONS = ["agree", "disagree", "abstain"];

/**
 * 生成测试用户数据
 */
function generateTestUsers(count) {
  const users = [];
  for (let i = 1; i <= count; i++) {
    users.push({
      userId: `test_user_${Date.now()}_${i}`,
      openId: `test_openid_${Date.now()}_${i}`,
      name: `测试用户${i}`,
      buildingNo: `${Math.floor(i / 10) + 1}号楼`,
      unitNo: `${(i % 6) + 1}单元`,
      roomNo: `${(i % 18) + 1}01`,
      area: 80 + Math.floor(Math.random() * 100), // 80-180 平米
    });
  }
  return users;
}

/**
 * 模拟单个用户投票
 */
async function simulateVote(user, voteId, choice) {
  const startTime = Date.now();

  try {
    // 调用提交投票的云函数
    const result = await app.callFunction({
      name: "submitVote", // 假设云函数名为 submitVote
      data: {
        voteId: voteId,
        userId: user.userId,
        openId: user.openId,
        choice: choice,
        userInfo: {
          name: user.name,
          buildingNo: user.buildingNo,
          unitNo: user.unitNo,
          roomNo: user.roomNo,
          area: user.area,
        },
        communityId: TEST_CONFIG.communityId,
      },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      success: result.result?.success || false,
      duration: duration,
      user: user.name,
      choice: choice,
      error: result.result?.error || null,
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      success: false,
      duration: duration,
      user: user.name,
      choice: choice,
      error: error.message,
    };
  }
}

/**
 * 执行并发投票测试
 */
async function runConcurrentTest(users, voteId, roundNumber) {
  console.log(
    `\n==================== 第 ${roundNumber} 轮测试 ====================`,
  );
  console.log(`时间: ${new Date().toLocaleString()}`);
  console.log(`并发用户数: ${users.length}\n`);

  const startTime = Date.now();

  // 为每个用户随机选择投票选项
  const voteTasks = users.map((user) => {
    const choice =
      VOTE_OPTIONS[Math.floor(Math.random() * VOTE_OPTIONS.length)];
    return simulateVote(user, voteId, choice);
  });

  // 并发执行所有投票
  const results = await Promise.all(voteTasks);

  const endTime = Date.now();
  const totalDuration = endTime - startTime;

  // 统计结果
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const avgDuration =
    results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const maxDuration = Math.max(...results.map((r) => r.duration));
  const minDuration = Math.min(...results.map((r) => r.duration));

  // 按选项统计
  const choiceStats = {
    agree: results.filter((r) => r.choice === "agree" && r.success).length,
    disagree: results.filter((r) => r.choice === "disagree" && r.success)
      .length,
    abstain: results.filter((r) => r.choice === "abstain" && r.success).length,
  };

  // 输出结果
  console.log("测试结果:");
  console.log(`  总耗时: ${totalDuration}ms`);
  console.log(`  成功数: ${successCount}`);
  console.log(`  失败数: ${failCount}`);
  console.log(
    `  成功率: ${((successCount / results.length) * 100).toFixed(2)}%`,
  );
  console.log(`\n响应时间统计:`);
  console.log(`  平均: ${avgDuration.toFixed(2)}ms`);
  console.log(`  最快: ${minDuration}ms`);
  console.log(`  最慢: ${maxDuration}ms`);
  console.log(`\n投票选项分布:`);
  console.log(`  同意: ${choiceStats.agree} 票`);
  console.log(`  反对: ${choiceStats.disagree} 票`);
  console.log(`  弃权: ${choiceStats.abstain} 票`);

  // 输出失败详情
  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.log(`\n失败详情:`);
    failures.forEach((f, idx) => {
      console.log(`  ${idx + 1}. ${f.user}: ${f.error}`);
    });
  }

  return {
    round: roundNumber,
    totalDuration,
    successCount,
    failCount,
    avgDuration,
    maxDuration,
    minDuration,
    choiceStats,
    failures: failures.map((f) => ({
      user: f.user,
      error: f.error,
    })),
  };
}

/**
 * 验证数据准确性
 */
async function verifyVoteData(voteId) {
  console.log(`\n==================== 数据验证 ====================`);

  try {
    // 查询投票记录
    const records = await db
      .collection("vote_records")
      .where({ voteId: voteId })
      .get();

    const totalRecords = records.data.length;

    // 统计各选项
    const stats = {
      agree: records.data.filter((r) => r.choice === "agree").length,
      disagree: records.data.filter((r) => r.choice === "disagree").length,
      abstain: records.data.filter((r) => r.choice === "abstain").length,
    };

    // 检查是否有重复投票
    const userIds = records.data.map((r) => r.userId);
    const uniqueUserIds = new Set(userIds);
    const duplicateCount = userIds.length - uniqueUserIds.size;

    console.log(`数据库中的投票记录:`);
    console.log(`  总记录数: ${totalRecords}`);
    console.log(`  唯一用户数: ${uniqueUserIds.size}`);
    console.log(`  重复投票数: ${duplicateCount}`);
    console.log(`\n选项分布:`);
    console.log(`  同意: ${stats.agree} 票`);
    console.log(`  反对: ${stats.disagree} 票`);
    console.log(`  弃权: ${stats.abstain} 票`);

    if (duplicateCount > 0) {
      console.log(`\n⚠️  警告: 发现重复投票，数据完整性可能存在问题！`);
    } else {
      console.log(`\n✓ 数据完整性检查通过，没有重复投票`);
    }

    return {
      totalRecords,
      uniqueUsers: uniqueUserIds.size,
      duplicates: duplicateCount,
      stats,
    };
  } catch (error) {
    console.error(`数据验证失败:`, error.message);
    return null;
  }
}

/**
 * 清理测试数据
 */
async function cleanupTestData(voteId) {
  console.log(`\n==================== 清理测试数据 ====================`);

  try {
    const result = await db
      .collection("vote_records")
      .where({
        voteId: voteId,
        userId: db.RegExp({
          regexp: "^test_user_",
          options: "i",
        }),
      })
      .remove();

    console.log(`✓ 已删除 ${result.deleted} 条测试投票记录`);
  } catch (error) {
    console.error(`清理失败:`, error.message);
  }
}

/**
 * 生成测试报告
 */
function generateReport(testResults, verifyResult) {
  console.log(`\n`);
  console.log(`========================================`);
  console.log(`       并发投票测试报告`);
  console.log(`========================================`);
  console.log(`测试时间: ${new Date().toLocaleString()}`);
  console.log(`投票ID: ${TEST_CONFIG.voteId}`);
  console.log(`并发用户数: ${TEST_CONFIG.concurrentUsers}`);
  console.log(`测试轮数: ${TEST_CONFIG.testRounds}`);
  console.log(`\n总体结果:`);

  const totalSuccess = testResults.reduce((sum, r) => sum + r.successCount, 0);
  const totalFail = testResults.reduce((sum, r) => sum + r.failCount, 0);
  const avgResponseTime =
    testResults.reduce((sum, r) => sum + r.avgDuration, 0) / testResults.length;

  console.log(`  总成功数: ${totalSuccess}`);
  console.log(`  总失败数: ${totalFail}`);
  console.log(
    `  总成功率: ${((totalSuccess / (totalSuccess + totalFail)) * 100).toFixed(2)}%`,
  );
  console.log(`  平均响应时间: ${avgResponseTime.toFixed(2)}ms`);

  console.log(`\n各轮详情:`);
  testResults.forEach((result) => {
    console.log(`  第${result.round}轮:`);
    console.log(`    成功: ${result.successCount}, 失败: ${result.failCount}`);
    console.log(`    平均响应: ${result.avgDuration.toFixed(2)}ms`);
  });

  if (verifyResult) {
    console.log(`\n数据完整性:`);
    console.log(`  数据库记录数: ${verifyResult.totalRecords}`);
    console.log(`  唯一用户数: ${verifyResult.uniqueUsers}`);
    console.log(`  重复记录数: ${verifyResult.duplicates}`);

    if (verifyResult.duplicates === 0) {
      console.log(`  ✓ 数据完整性: 通过`);
    } else {
      console.log(`  ✗ 数据完整性: 失败 (存在重复投票)`);
    }
  }

  console.log(`\n结论:`);
  if (totalFail === 0 && (!verifyResult || verifyResult.duplicates === 0)) {
    console.log(`  ✓ 系统稳定，所有测试通过`);
  } else if (totalFail > 0) {
    console.log(`  ⚠️  系统存在失败情况，建议检查错误日志`);
  }
  if (verifyResult && verifyResult.duplicates > 0) {
    console.log(`  ⚠️  发现重复投票，需要检查防重复机制`);
  }

  console.log(`========================================\n`);
}

/**
 * 主函数
 */
async function main() {
  console.log(`\n========================================`);
  console.log(`     社区投票系统 - 并发测试工具`);
  console.log(`========================================\n`);

  // 检查配置
  if (!TEST_CONFIG.voteId || !TEST_CONFIG.communityId) {
    console.error(`❌ 错误: 请先配置 voteId 和 communityId`);
    console.log(`\n请按以下步骤操作:`);
    console.log(`1. 在管理后台创建一个测试投票`);
    console.log(`2. 获取投票的 ID 和社区 ID`);
    console.log(`3. 在脚本的 TEST_CONFIG 中填入这些值`);
    console.log(`4. 重新运行测试脚本\n`);
    return;
  }

  console.log(`测试配置:`);
  console.log(`  投票ID: ${TEST_CONFIG.voteId}`);
  console.log(`  社区ID: ${TEST_CONFIG.communityId}`);
  console.log(`  并发用户数: ${TEST_CONFIG.concurrentUsers}`);
  console.log(`  测试轮数: ${TEST_CONFIG.testRounds}`);

  // 确认开始测试
  console.log(`\n准备开始测试，按 Ctrl+C 取消...\n`);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    // 生成测试用户
    const testUsers = generateTestUsers(TEST_CONFIG.concurrentUsers);
    console.log(`✓ 已生成 ${testUsers.length} 个测试用户\n`);

    // 执行多轮测试
    const testResults = [];
    for (let i = 1; i <= TEST_CONFIG.testRounds; i++) {
      const result = await runConcurrentTest(testUsers, TEST_CONFIG.voteId, i);
      testResults.push(result);

      // 如果不是最后一轮，等待一段时间
      if (i < TEST_CONFIG.testRounds) {
        console.log(
          `\n等待 ${TEST_CONFIG.delayBetweenRounds / 1000} 秒后开始下一轮...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, TEST_CONFIG.delayBetweenRounds),
        );
      }
    }

    // 验证数据
    const verifyResult = await verifyVoteData(TEST_CONFIG.voteId);

    // 生成报告
    generateReport(testResults, verifyResult);

    // 询问是否清理测试数据
    console.log(`\n是否清理测试数据？(y/n)`);
    console.log(`或者稍后运行: node cleanup-test-votes.js`);

    // 自动清理测试数据（取消注释以启用）
    // await cleanupTestData(TEST_CONFIG.voteId);
  } catch (error) {
    console.error(`\n❌ 测试过程中发生错误:`, error);
  }

  console.log(`\n测试完成！\n`);
}

// 运行测试
if (require.main === module) {
  main().catch((error) => {
    console.error("脚本执行失败:", error);
    process.exit(1);
  });
}

module.exports = {
  generateTestUsers,
  simulateVote,
  runConcurrentTest,
  verifyVoteData,
  cleanupTestData,
};
