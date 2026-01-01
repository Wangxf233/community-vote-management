const express = require("express");
const router = express.Router();
const { db, tcb } = require("../config/db");
const { verifyToken } = require("../middleware/auth");

// 将 cloud:// fileID 转换为 HTTPS URL
async function convertFileIDsToURLs(items) {
  const allFileIDs = [];
  const fileIDMap = new Map();

  // 收集所有 fileID
  items.forEach((item, index) => {
    if (item.images && Array.isArray(item.images)) {
      item.images.forEach((img) => {
        if (img && img.startsWith("cloud://")) {
          allFileIDs.push(img);
          if (!fileIDMap.has(img)) {
            fileIDMap.set(img, []);
          }
          fileIDMap.get(img).push({ index, type: "images", img });
        }
      });
    }
    if (item.video && item.video.startsWith("cloud://")) {
      allFileIDs.push(item.video);
      if (!fileIDMap.has(item.video)) {
        fileIDMap.set(item.video, []);
      }
      fileIDMap.get(item.video).push({ index, type: "video" });
    }
  });

  // 如果没有需要转换的 fileID,直接返回
  if (allFileIDs.length === 0) {
    return items;
  }

  try {
    // 批量获取临时链接
    const result = await tcb.getTempFileURL({
      fileList: [...new Set(allFileIDs)],
    });

    // 创建 fileID 到 URL 的映射
    const urlMap = new Map();
    result.fileList.forEach((file) => {
      if (file.tempFileURL) {
        urlMap.set(file.fileID, file.tempFileURL);
      }
    });

    // 替换所有 fileID 为 URL
    items.forEach((item, index) => {
      if (item.images && Array.isArray(item.images)) {
        item.images = item.images.map((img) => {
          return img && img.startsWith("cloud://") && urlMap.has(img)
            ? urlMap.get(img)
            : img;
        });
      }
      if (
        item.video &&
        item.video.startsWith("cloud://") &&
        urlMap.has(item.video)
      ) {
        item.video = urlMap.get(item.video);
      }
    });

    return items;
  } catch (error) {
    console.error("转换 fileID 失败:", error);
    return items; // 转换失败时返回原数据
  }
}

/**
 * GET /api/repairs - 获取报修列表
 * Query: page, pageSize, equipment, location, startDate, endDate, isUrgent, status
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      equipment,
      location,
      startDate,
      endDate,
      isUrgent,
      status,
    } = req.query;

    const userRole = req.user.role;
    const communityId = req.user.communityId;

    // 构建查询条件
    const where = {};

    // 社区管理员只能查看自己社区的报修
    if (["community", "community_admin"].includes(userRole)) {
      if (!communityId) {
        return res
          .status(403)
          .json({ success: false, error: "no_community_access" });
      }
      where.communityId = communityId;
    }

    // 添加筛选条件
    if (equipment) where.equipment = equipment;
    if (location) {
      // 使用模糊查询
      where.location = db.RegExp({
        regexp: location,
        options: "i",
      });
    }
    if (isUrgent !== undefined) where.isUrgent = isUrgent === "true";
    if (status) where.status = status;
    if (startDate || endDate) {
      const _ = db.command;
      const timeConditions = [];
      if (startDate) timeConditions.push(_.gte(new Date(startDate)));
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        timeConditions.push(_.lte(endDateTime));
      }
      if (timeConditions.length > 0) {
        where.submitTime =
          timeConditions.length === 1
            ? timeConditions[0]
            : _.and(...timeConditions);
      }
    }

    // 查询总数
    const countRes = await db.collection("repairs").where(where).count();
    const total = countRes.total;

    // 分页查询
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const result = await db
      .collection("repairs")
      .where(where)
      .orderBy("submitTime", "desc")
      .skip(skip)
      .limit(parseInt(pageSize))
      .get();

    // 转换 cloud:// fileID 为 HTTPS URL
    const dataWithURLs = await convertFileIDsToURLs(result.data);

    return res.json({
      success: true,
      data: dataWithURLs,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
  } catch (e) {
    console.error("获取报修列表失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/repairs - 创建报修
 * Body: { communityId, equipment, location, description, images, video, isUrgent, userId, userName }
 */
router.post("/", async (req, res) => {
  try {
    const {
      communityId,
      equipment,
      location,
      description,
      images = [],
      video = "",
      isUrgent = false,
      userId,
      userName,
    } = req.body;

    if (!communityId || !equipment || !location || !description) {
      return res.status(400).json({ success: false, error: "missing_params" });
    }

    const repairData = {
      communityId,
      equipment,
      location,
      description,
      images,
      video,
      isUrgent,
      status: "pending", // pending, processing, completed
      remark: "",
      userId,
      userName,
      submitTime: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("repairs").add(repairData);

    return res.json({
      success: true,
      data: { _id: result.id, ...repairData },
    });
  } catch (e) {
    console.error("创建报修失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PUT /api/repairs/:id - 更新报修状态或备注
 * Body: { status?, remark? }
 */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remark } = req.body;

    if (!status && remark === undefined) {
      return res.status(400).json({ success: false, error: "missing_params" });
    }

    // 查询报修信息
    const repairRes = await db.collection("repairs").doc(id).get();
    if (!repairRes.data || repairRes.data.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "repair_not_found" });
    }

    const repair = repairRes.data[0];
    const userRole = req.user.role;
    const communityId = req.user.communityId;

    // 权限检查：社区管理员只能管理自己社区的报修
    if (
      ["community", "community_admin"].includes(userRole) &&
      repair.communityId !== communityId
    ) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    // 构建更新数据
    const updates = { updatedAt: new Date() };
    if (status) {
      if (!["pending", "processing", "completed"].includes(status)) {
        return res
          .status(400)
          .json({ success: false, error: "invalid_status" });
      }
      updates.status = status;
    }
    if (remark !== undefined) {
      updates.remark = remark;
    }

    await db.collection("repairs").doc(id).update(updates);

    return res.json({ success: true });
  } catch (e) {
    console.error("更新报修失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * DELETE /api/repairs/:id - 删除报修（仅超级管理员）
 */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 只有超级管理员可以删除
    if (req.user.role !== "super") {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    await db.collection("repairs").doc(id).remove();

    return res.json({ success: true });
  } catch (e) {
    console.error("删除报修失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

module.exports = router;
