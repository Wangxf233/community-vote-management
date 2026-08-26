const express = require("express");
const router = express.Router();
const { db, tcb } = require("../config/db");
const { verifyToken } = require("../middleware/auth");
const _ = db.command;

// 附件入库前净化：仅保留 name/url/fileID 字段
function sanitizeAttachments(list) {
  return (Array.isArray(list) ? list : []).map((att) => ({
    name: (att && att.name) || "",
    url: (att && att.url) || "",
    ...(att && att.fileID ? { fileID: att.fileID } : {}),
  }));
}

// 附件链接刷新：用 fileID（或 cloud:// 旧链接）换取新的临时链接，避免上传时存的 7 天临时链接过期
async function refreshAttachmentUrls(items) {
  const keys = [];
  (items || []).forEach((item) => {
    (item.attachments || []).forEach((att) => {
      if (att.fileID && typeof att.fileID === "string" && att.fileID.startsWith("cloud://")) {
        keys.push(att.fileID);
      } else if (typeof att.url === "string" && att.url.startsWith("cloud://")) {
        keys.push(att.url);
      }
    });
  });

  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) return;

  try {
    const urlRes = await tcb.getTempFileURL({
      fileList: uniqueKeys,
      maxAge: 604800, // 7天
    });
    const urlMap = {};
    (urlRes.fileList || []).forEach((f) => {
      if (f.fileID && (f.tempFileURL || f.download_url)) {
        urlMap[f.fileID] = f.download_url || f.tempFileURL;
      }
    });

    items.forEach((item) => {
      item.attachments = (item.attachments || []).map((att) => {
        const key = att.fileID && urlMap[att.fileID] ? att.fileID : att.url;
        return urlMap[key] ? { ...att, url: urlMap[key] } : att;
      });
    });
  } catch (e) {
    console.error("刷新附件链接失败:", e.message);
  }
}

// 计算有效期截止时间
function calculateExpiryTime(announcement) {
  if (announcement.expiryTime) {
    return new Date(announcement.expiryTime);
  }

  if (announcement.expiryDays && announcement.publishTime) {
    const publishTime = new Date(announcement.publishTime);
    const expiryTime = new Date(
      publishTime.getTime() + announcement.expiryDays * 24 * 60 * 60 * 1000,
    );
    return expiryTime;
  }

  return null;
}

// 检查并更新过期的通知
async function checkAndUpdateExpiredAnnouncements() {
  try {
    const now = new Date();

    // 只获取已有明确 expiryTime 且已过期的公告（县需在 DB 层过滤）
    // expiryDays 类型的公告因 expiryTime 字段在创建时应迎名计算存入，这里统一用 expiryTime 字段判断
    const result = await db
      .collection("announcements")
      .where({
        status: "published",
        expiryTime: _.lt(now),
      })
      .limit(200)
      .get();

    if (result.data.length === 0) return;

    // 进一步验证（兼容旧数据中 expiryTime 可能不存在的情况）
    const expiredIds = result.data
      .filter((item) => {
        const expiryTime = calculateExpiryTime(item);
        return expiryTime && now > expiryTime;
      })
      .map((item) => item._id);

    // 批量更新为已过期状态
    if (expiredIds.length > 0) {
      await db
        .collection("announcements")
        .where({ _id: _.in(expiredIds) })
        .update({ status: "expired", updatedAt: now });
    }
  } catch (error) {
    console.error("检查过期通知失败:", error);
  }
}

// 每小时检查一次过期通知
setInterval(checkAndUpdateExpiredAnnouncements, 60 * 60 * 1000);
// 立即执行一次
checkAndUpdateExpiredAnnouncements();

// 获取公告列表
router.get("/", verifyToken, async (req, res) => {
  try {
    const {
      type,
      title,
      publisher,
      startDate,
      endDate,
      page = 1,
      pageSize = 10,
    } = req.query;

    // 越权防护：非超级管理员只能访问本小区公告
    let { communityId } = req.query;
    if (req.user.role !== "super") {
      communityId = req.user.communityId;
    }
    if (!communityId) {
      return res.status(400).json({ success: false, error: "缺少小区ID" });
    }

    const where = { communityId };

    // 筛选条件
    if (type) where.type = type;
    if (publisher) where.publisher = publisher;
    if (title) where.title = db.RegExp({ regexp: title });

    // 发布时间范围筛选
    if (startDate || endDate) {
      where.publishTime = {};
      if (startDate) where.publishTime[_.gte] = new Date(startDate);
      if (endDate) where.publishTime[_.lte] = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    const [countResult, result] = await Promise.all([
      db.collection("announcements").where(where).count(),
      db
        .collection("announcements")
        .where(where)
        .orderBy("isPinned", "desc")
        .orderBy("publishTime", "desc")
        .skip(skip)
        .limit(limit)
        .get(),
    ]);

    // 计算每个通知的实际状态（检查是否过期）
    const now = new Date();
    const dataWithStatus = result.data.map((item) => {
      let actualStatus = item.status;

      // 检查是否过期
      if (item.status === "published") {
        const expiryTime = calculateExpiryTime(item);
        if (expiryTime && now > expiryTime) {
          actualStatus = "expired";
        }
      }

      return {
        ...item,
        actualStatus,
      };
    });

    // 附件链接刷新（避免上传时保存的临时链接过期）
    await refreshAttachmentUrls(dataWithStatus);

    res.json({
      success: true,
      data: dataWithStatus,
      total: countResult.total,
    });
  } catch (error) {
    console.error("获取公告列表失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加公告
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      title,
      publisher,
      publishTime,
      publishNow,
      content,
      attachments,
      type,
      communityId,
      expiryDays,
      expiryTime,
    } = req.body;

    // 越权防护：非超级管理员只能发布到本小区
    let effectiveCommunityId = communityId;
    if (req.user.role !== "super") {
      effectiveCommunityId = req.user.communityId;
    }

    if (!title || !publisher || !content || !type || !effectiveCommunityId) {
      return res.status(400).json({ success: false, error: "缺少必填字段" });
    }

    const now = new Date();
    const finalPublishTime = publishNow ? now : new Date(publishTime);

    const announcementData = {
      title,
      publisher,
      publishTime: finalPublishTime,
      content,
      attachments: sanitizeAttachments(attachments),
      type,
      communityId: effectiveCommunityId,
      status: finalPublishTime <= now ? "published" : "scheduled",
      isPinned: false,
      viewCount: 0,
      expiryDays: expiryDays || 3,
      expiryTime: expiryTime ? new Date(expiryTime) : null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("announcements").add(announcementData);

    res.json({
      success: true,
      data: { _id: result.id, ...announcementData },
    });
  } catch (error) {
    console.error("添加公告失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新公告
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      publisher,
      publishTime,
      publishNow,
      content,
      attachments,
      expiryDays,
      expiryTime,
    } = req.body;

    // 越权防护：校验公告归属，非超级管理员只能操作本小区公告
    const targetRes = await db.collection("announcements").doc(id).get();
    if (!targetRes.data || targetRes.data.length === 0) {
      return res.status(404).json({ success: false, error: "公告不存在" });
    }
    if (
      req.user.role !== "super" &&
      targetRes.data[0].communityId !== req.user.communityId
    ) {
      return res.status(403).json({ success: false, error: "无权操作该公告" });
    }

    const updateData = {
      updatedAt: new Date(),
    };

    if (title) updateData.title = title;
    if (publisher) updateData.publisher = publisher;
    if (content) updateData.content = content;
    if (attachments !== undefined)
      updateData.attachments = sanitizeAttachments(attachments);
    if (expiryDays !== undefined) updateData.expiryDays = expiryDays;
    if (expiryTime !== undefined)
      updateData.expiryTime = expiryTime ? new Date(expiryTime) : null;

    if (publishNow !== undefined || publishTime) {
      const now = new Date();
      const finalPublishTime = publishNow ? now : new Date(publishTime);
      updateData.publishTime = finalPublishTime;
      updateData.status = finalPublishTime <= now ? "published" : "scheduled";
    }

    await db.collection("announcements").doc(id).update(updateData);

    res.json({ success: true });
  } catch (error) {
    console.error("更新公告失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 置顶/取消置顶
router.put("/:id/pin", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isPinned } = req.body;

    // 越权防护：校验公告归属
    const targetRes = await db.collection("announcements").doc(id).get();
    if (!targetRes.data || targetRes.data.length === 0) {
      return res.status(404).json({ success: false, error: "公告不存在" });
    }
    if (
      req.user.role !== "super" &&
      targetRes.data[0].communityId !== req.user.communityId
    ) {
      return res.status(403).json({ success: false, error: "无权操作该公告" });
    }

    await db.collection("announcements").doc(id).update({
      isPinned: isPinned,
      updatedAt: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("置顶公告失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 停用/启用
router.put("/:id/status", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // 越权防护：校验公告归属
    const targetRes = await db.collection("announcements").doc(id).get();
    if (!targetRes.data || targetRes.data.length === 0) {
      return res.status(404).json({ success: false, error: "公告不存在" });
    }
    if (
      req.user.role !== "super" &&
      targetRes.data[0].communityId !== req.user.communityId
    ) {
      return res.status(403).json({ success: false, error: "无权操作该公告" });
    }

    await db.collection("announcements").doc(id).update({
      status: status,
      updatedAt: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("更新公告状态失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除公告
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 越权防护：校验公告归属
    const targetRes = await db.collection("announcements").doc(id).get();
    if (!targetRes.data || targetRes.data.length === 0) {
      return res.status(404).json({ success: false, error: "公告不存在" });
    }
    if (
      req.user.role !== "super" &&
      targetRes.data[0].communityId !== req.user.communityId
    ) {
      return res.status(403).json({ success: false, error: "无权操作该公告" });
    }

    await db.collection("announcements").doc(id).remove();

    res.json({ success: true });
  } catch (error) {
    console.error("删除公告失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取公告详情
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.collection("announcements").doc(id).get();

    if (!result.data || result.data.length === 0) {
      return res.status(404).json({ success: false, error: "公告不存在" });
    }

    const item = result.data[0];
    let actualStatus = item.status;

    // 越权防护：校验公告归属，非超级管理员只能查看本小区公告
    if (
      req.user.role !== "super" &&
      item.communityId !== req.user.communityId
    ) {
      return res.status(403).json({ success: false, error: "无权访问该公告" });
    }

    // 检查是否过期
    if (item.status === "published") {
      const now = new Date();
      const expiryTime = calculateExpiryTime(item);
      if (expiryTime && now > expiryTime) {
        actualStatus = "expired";
      }
    }

    // 附件链接刷新（避免上传时保存的临时链接过期）
    await refreshAttachmentUrls([item]);

    res.json({
      success: true,
      data: {
        ...item,
        actualStatus,
      },
    });
  } catch (error) {
    console.error("获取公告详情失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
