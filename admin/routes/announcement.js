const express = require("express");
const router = express.Router();
const { db } = require("../config/db");
const { verifyToken } = require("../middleware/auth");
const _ = db.command;

// 计算有效期截止时间
function calculateExpiryTime(announcement) {
  if (announcement.expiryTime) {
    return new Date(announcement.expiryTime);
  }

  if (announcement.expiryDays && announcement.publishTime) {
    const publishTime = new Date(announcement.publishTime);
    const expiryTime = new Date(
      publishTime.getTime() + announcement.expiryDays * 24 * 60 * 60 * 1000
    );
    return expiryTime;
  }

  return null;
}

// 检查并更新过期的通知
async function checkAndUpdateExpiredAnnouncements() {
  try {
    const now = new Date();

    // 查找所有已发布的通知
    const result = await db
      .collection("announcements")
      .where({
        status: "published",
      })
      .get();

    // 检查哪些已过期
    const expiredIds = [];
    result.data.forEach((item) => {
      const expiryTime = calculateExpiryTime(item);
      if (expiryTime && now > expiryTime) {
        expiredIds.push(item._id);
      }
    });

    // 批量更新为已过期状态
    if (expiredIds.length > 0) {
      const updatePromises = expiredIds.map((id) =>
        db.collection("announcements").doc(id).update({
          status: "expired",
          updatedAt: now,
        })
      );
      await Promise.all(updatePromises);
      console.log(`更新了 ${expiredIds.length} 个过期通知`);
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
      communityId,
      type,
      title,
      publisher,
      startDate,
      endDate,
      page = 1,
      pageSize = 10,
    } = req.query;

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

    const countResult = await db
      .collection("announcements")
      .where(where)
      .count();

    const result = await db
      .collection("announcements")
      .where(where)
      .orderBy("isPinned", "desc")
      .orderBy("publishTime", "desc")
      .skip(skip)
      .limit(limit)
      .get();

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

    if (!title || !publisher || !content || !type || !communityId) {
      return res.status(400).json({ success: false, error: "缺少必填字段" });
    }

    const now = new Date();
    const finalPublishTime = publishNow ? now : new Date(publishTime);

    const announcementData = {
      title,
      publisher,
      publishTime: finalPublishTime,
      content,
      attachments: attachments || [],
      type,
      communityId,
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

    const updateData = {
      updatedAt: new Date(),
    };

    if (title) updateData.title = title;
    if (publisher) updateData.publisher = publisher;
    if (content) updateData.content = content;
    if (attachments !== undefined) updateData.attachments = attachments;
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

    // 检查是否过期
    if (item.status === "published") {
      const now = new Date();
      const expiryTime = calculateExpiryTime(item);
      if (expiryTime && now > expiryTime) {
        actualStatus = "expired";
      }
    }

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
