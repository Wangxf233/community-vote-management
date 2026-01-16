const express = require("express");
const { db } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const router = express.Router();
const _ = db.command;

// 获取小区基本情况
router.get("/:communityId", authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;

    const info = await db
      .collection("community_info")
      .where({ communityId })
      .get();

    if (info.data && info.data.length > 0) {
      res.json({ data: info.data[0] });
    } else {
      res.status(404).json({ error: "未找到小区信息" });
    }
  } catch (err) {
    console.error("获取小区信息失败:", err);
    res.status(500).json({ error: "获取小区信息失败" });
  }
});

// 更新小区基本情况
router.put("/:communityId", authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;
    const updateData = req.body;

    const collection = db.collection("community_info");

    // 检查是否已存在
    const existing = await collection.where({ communityId }).get();

    if (existing.data && existing.data.length > 0) {
      // 更新现有记录
      const docId = existing.data[0]._id;
      await collection.doc(docId).update({
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });
    } else {
      // 创建新记录
      await collection.add({
        data: {
          communityId,
          ...updateData,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    res.json({ message: "保存成功" });
  } catch (err) {
    console.error("保存小区信息失败:", err);
    res.status(500).json({ error: "保存小区信息失败", details: err.message });
  }
});

module.exports = router;
