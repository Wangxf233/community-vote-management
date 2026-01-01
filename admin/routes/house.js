const express = require("express");
const { db } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/house-config - 获取房屋配置
 */
router.get("/house-config", authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    const configRes = await db
      .collection("house_config")
      .where({ communityId: user.communityId })
      .limit(1)
      .get();

    const config =
      configRes.data && configRes.data[0] ? configRes.data[0] : null;

    return res.json({
      success: true,
      config: config || { buildings: [] },
    });
  } catch (e) {
    console.error("获取房屋配置失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/house-config - 保存房屋配置
 */
router.post("/house-config", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { buildings } = req.body;

    if (!buildings || !Array.isArray(buildings)) {
      return res.status(400).json({ success: false, error: "invalid_data" });
    }

    // 检查是否已存在配置
    const existingRes = await db
      .collection("house_config")
      .where({ communityId: user.communityId })
      .limit(1)
      .get();

    const now = new Date().toISOString();
    const configData = {
      communityId: user.communityId,
      buildings,
      updatedAt: now,
    };

    if (existingRes.data && existingRes.data.length > 0) {
      // 更新
      await db
        .collection("house_config")
        .doc(existingRes.data[0]._id)
        .update(configData);
    } else {
      // 新增
      configData.createdAt = now;
      await db.collection("house_config").add({ data: configData });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("保存房屋配置失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

module.exports = router;
