const { db, tcb } = require("./config/db");

async function listAllCollections() {
  try {
    console.log("尝试列出所有可能的评价相关集合...\n");

    const possibleCollections = [
      "evaluation_cycles",
      "evaluation_staff",
      "evaluations",
      "evaluation",
      "staff_evaluations",
      "cycle_evaluations",
      "evaluation_results",
      "service_evaluations",
    ];

    for (const collectionName of possibleCollections) {
      try {
        const result = await db.collection(collectionName).limit(1).get();
        console.log(
          `✓ 找到集合: ${collectionName} (记录数: ${result.data.length})`
        );
        if (result.data.length > 0) {
          console.log(`  字段: ${Object.keys(result.data[0]).join(", ")}`);
        }
      } catch (error) {
        console.log(`✗ 不存在: ${collectionName}`);
      }
    }

    console.log("\n\n尝试通过云函数获取集合列表...");
    // 如果SDK支持，尝试列出所有集合
  } catch (error) {
    console.error("错误:", error);
  }

  process.exit(0);
}

listAllCollections();
