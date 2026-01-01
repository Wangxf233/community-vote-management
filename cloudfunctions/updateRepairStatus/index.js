const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { id, deleted, status, remark } = event;

  try {
    if (!id) {
      return {
        success: false,
        error: "缺少记录ID",
      };
    }

    const updateData = {
      updatedAt: new Date(),
    };

    if (deleted !== undefined) {
      updateData.deleted = deleted;
    }
    if (status) {
      updateData.status = status;
    }
    if (remark !== undefined) {
      updateData.remark = remark;
    }

    // 尝试更新 repairs 集合
    try {
      const result = await db.collection("repairs").doc(id).update({
        data: updateData,
      });

      if (result.stats.updated > 0) {
        return {
          success: true,
        };
      }
    } catch (err) {
      // 如果 repairs 中没有，尝试 reports 集合
      const result = await db.collection("reports").doc(id).update({
        data: updateData,
      });

      if (result.stats.updated > 0) {
        return {
          success: true,
        };
      }
    }

    return {
      success: false,
      error: "记录不存在",
    };
  } catch (error) {
    console.error("更新失败:", error);
    return {
      success: false,
      error: error.message || "更新失败",
    };
  }
};
