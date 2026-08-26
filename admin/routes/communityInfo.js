const express = require("express");
const { db, tcb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const router = express.Router();
const _ = db.command;

// 图片链接刷新：用 fileID（或 cloud:// 旧链接）换取新的临时链接，避免上传时保存的 7 天临时链接过期
async function refreshImageUrls(info) {
  const pairs = [
    { urlKey: "planImage", idKey: "planImageFileID", array: false },
    { urlKey: "effectImage", idKey: "effectImageFileID", array: false },
    { urlKey: "adImages", idKey: "adImageFileIDs", array: true },
    { urlKey: "communityImages", idKey: "communityImageFileIDs", array: true },
  ];

  const keys = [];
  const slots = []; // { urlKey, index } 与 keys 一一对应
  pairs.forEach(({ urlKey, idKey, array }) => {
    if (!array) {
      const id = info[idKey];
      const url = info[urlKey];
      let key = "";
      if (id && typeof id === "string" && id.startsWith("cloud://")) key = id;
      else if (typeof url === "string" && url.startsWith("cloud://")) key = url;
      if (key) {
        keys.push(key);
        slots.push({ urlKey, index: null });
      }
    } else {
      const urls = Array.isArray(info[urlKey]) ? info[urlKey] : [];
      const ids = Array.isArray(info[idKey]) ? info[idKey] : [];
      urls.forEach((u, i) => {
        const id = ids[i];
        let key = "";
        if (id && typeof id === "string" && id.startsWith("cloud://")) key = id;
        else if (typeof u === "string" && u.startsWith("cloud://")) key = u;
        if (key) {
          keys.push(key);
          slots.push({ urlKey, index: i });
        }
      });
    }
  });

  if (keys.length === 0) return info;

  try {
    const urlRes = await tcb.getTempFileURL({
      fileList: [...new Set(keys)],
      maxAge: 604800, // 7天
    });
    const urlMap = {};
    (urlRes.fileList || []).forEach((f) => {
      if (f.fileID && (f.tempFileURL || f.download_url)) {
        urlMap[f.fileID] = f.download_url || f.tempFileURL;
      }
    });
    slots.forEach(({ urlKey, index }, i) => {
      const key = keys[i];
      if (!urlMap[key]) return;
      if (index === null) {
        info[urlKey] = urlMap[key];
      } else {
        info[urlKey][index] = urlMap[key];
      }
    });
  } catch (e) {
    console.error("刷新图片链接失败:", e.message);
  }

  return info;
}

// 获取小区基本情况
router.get("/:communityId", authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;

    // 越权防护：非超级管理员只能访问本小区信息
    if (req.user.role !== "super" && req.user.communityId !== communityId) {
      return res.status(403).json({ error: "无权访问该小区信息" });
    }

    const info = await db
      .collection("community_info")
      .where({ communityId })
      .get();

    if (info.data && info.data.length > 0) {
      // 直接返回文档数据，不包装在data里
      const doc = info.data[0];
      await refreshImageUrls(doc);
      res.json(doc);
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

    // 越权防护：非超级管理员只能修改本小区信息
    if (req.user.role !== "super" && req.user.communityId !== communityId) {
      return res.status(403).json({ error: "无权修改该小区信息" });
    }

    const updateData = { ...req.body };

    // 移除不能更新的字段
    delete updateData._id;
    delete updateData.communityId;
    delete updateData.createdAt;

    const collection = db.collection("community_info");

    // 检查是否已存在
    const existing = await collection.where({ communityId }).get();

    if (existing.data && existing.data.length > 0) {
      // 更新现有记录 - 直接更新顶层字段
      const docId = existing.data[0]._id;
      await collection.doc(docId).update({
        ...updateData,
        updatedAt: new Date(),
      });
    } else {
      // 创建新记录 - 直接在顶层存储
      await collection.add({
        communityId,
        ...updateData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    res.json({ message: "保存成功" });
  } catch (err) {
    console.error("保存小区信息失败:", err);
    res.status(500).json({ error: "保存小区信息失败", details: err.message });
  }
});

module.exports = router;
