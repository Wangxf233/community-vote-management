const express = require("express");
const router = express.Router();
const { db, tcb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const multer = require("multer");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const _ = db.command;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 导入文件最大 5MB，防止内存耗尽
});

// 所有端点都需要认证
router.use(authMiddleware);

// 确保违停集合存在（首次调用时创建，后续调用直接跳过）
let parkingViolationsReady = false;
async function ensureParkingViolationsCollection() {
  if (parkingViolationsReady) return;
  try {
    await db.createCollection("parking_violations");
  } catch (e) {
    // 已存在或创建失败均忽略，后续查询自行兜底
  }
  parkingViolationsReady = true;
}

/**
 * 解析小区隔离范围
 * - 小区管理员：强制使用自己的 communityId，无则返回 null（调用方回 403）
 * - 超管：使用请求中显式传入的 communityId（query 或 body），未传则 null（查询=全部小区）
 * @returns {string|null|undefined} communityId / null=无权 / undefined=不限制（仅超管查询）
 */
function resolveCommunityScope(req) {
  const userRole = req.user.role;
  const userCommunityId = req.user.communityId;

  if (userRole === "community" || userRole === "community_admin") {
    return userCommunityId || null;
  }
  // 超管
  const explicit =
    (req.query && req.query.communityId) ||
    (req.body && req.body.communityId) ||
    undefined;
  return explicit || undefined;
}

/**
 * 构建车辆查询条件
 */
function buildVehicleWhere(req) {
  const cid = resolveCommunityScope(req);
  if (cid === null) {
    return null; // 无小区权限
  }
  const { plateNumber, ownerName, ownerPhone } = req.query;
  const where = {};
  if (cid) where.communityId = cid;

  if (plateNumber) {
    where.plateNumber = db.RegExp({ regexp: plateNumber, options: "i" });
  }
  if (ownerName) {
    where.ownerName = db.RegExp({ regexp: ownerName, options: "i" });
  }
  if (ownerPhone) {
    where.ownerPhone = db.RegExp({ regexp: ownerPhone, options: "i" });
  }

  return where;
}

/**
 * GET /api/vehicles — 分页列表
 */
router.get("/", async (req, res) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);
    const where = buildVehicleWhere(req);

    if (where === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }

    const [countResult, result] = await Promise.all([
      db.collection("vehicles").where(where).count(),
      db
        .collection("vehicles")
        .where(where)
        .orderBy("createTime", "desc")
        .skip(skip)
        .limit(limit)
        .get(),
    ]);

    // 统计当前页车辆各自的违停次数（默认 0；集合不存在时全部按 0 处理）
    await ensureParkingViolationsCollection();
    const plates = (result.data || [])
      .map((v) => v.plateNumber)
      .filter(Boolean);
    const violationMap = {};
    if (plates.length > 0) {
      try {
        const violRes = await db
          .collection("parking_violations")
          .where({ communityId, plateNumber: _.in(plates) })
          .limit(1000)
          .get();
        (violRes.data || []).forEach((v) => {
          violationMap[v.plateNumber] = (violationMap[v.plateNumber] || 0) + 1;
        });
      } catch (countErr) {
        // 集合不存在等情况：违停次数按 0 处理，不影响车辆列表返回
        console.error("查询违停记录失败:", countErr.message);
      }
    }
    (result.data || []).forEach((v) => {
      v.violationCount = violationMap[v.plateNumber] || 0;
    });

    res.json({
      success: true,
      data: result.data,
      total: countResult.total,
    });
  } catch (err) {
    console.error("获取车辆列表失败:", err);
    res.status(500).json({ success: false, error: "获取车辆列表失败" });
  }
});

/**
 * GET /api/vehicles/export — Excel 导出
 */
router.get("/export", async (req, res) => {
  try {
    const where = buildVehicleWhere(req);
    if (where === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }
    const result = await db
      .collection("vehicles")
      .where(where)
      .orderBy("createTime", "desc")
      .get();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("车辆列表");

    worksheet.columns = [
      { header: "车辆类型", key: "vehicleType", width: 15 },
      { header: "车牌号", key: "plateNumber", width: 15 },
      { header: "车主姓名", key: "ownerName", width: 15 },
      { header: "车主电话", key: "ownerPhone", width: 15 },
      { header: "车位费", key: "parkingFee", width: 15 },
      { header: "车位编号", key: "parkingSpot", width: 15 },
      { header: "有效开始日期", key: "startDate", width: 15 },
      { header: "有效结束日期", key: "endDate", width: 15 },
      { header: "栋单元房号", key: "building", width: 20 },
      { header: "备注", key: "remark", width: 20 },
    ];

    // 写入数据行
    for (const row of result.data) {
      worksheet.addRow({
        vehicleType: row.vehicleType || "",
        plateNumber: row.plateNumber || "",
        ownerName: row.ownerName || "",
        ownerPhone: row.ownerPhone || "",
        parkingFee: row.parkingFee || "",
        parkingSpot: row.parkingSpot || "",
        startDate: row.startDate || "",
        endDate: row.endDate || "",
        building: row.building || "",
        remark: row.remark || "",
      });
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=vehicles_export.xlsx"
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("导出车辆数据失败:", err);
    res.status(500).json({ success: false, error: "导出车辆数据失败" });
  }
});

/**
 * GET /api/vehicles/template — 下载导入模板
 */
router.get("/template", async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("车辆导入模板");

    worksheet.columns = [
      { header: "车辆类型", key: "vehicleType", width: 15 },
      { header: "车牌号*", key: "plateNumber", width: 15 },
      { header: "车主姓名", key: "ownerName", width: 15 },
      { header: "车主电话*", key: "ownerPhone", width: 15 },
      { header: "车位费", key: "parkingFee", width: 15 },
      { header: "车位编号", key: "parkingSpot", width: 15 },
      { header: "有效开始日期", key: "startDate", width: 15 },
      { header: "有效结束日期", key: "endDate", width: 15 },
      { header: "栋单元房号", key: "building", width: 20 },
      { header: "备注", key: "remark", width: 20 },
    ];

    // 第二行：填写示例
    worksheet.addRow({
      vehicleType: "月租车",
      plateNumber: "鄂HB3425",
      ownerName: "王五",
      ownerPhone: "13012341234",
      parkingFee: "300",
      parkingSpot: "C502",
      startDate: "2019-10-11",
      endDate: "2019-12-11",
      building: "16-2-701",
      remark: "此人脾气不好",
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=vehicles_template.xlsx"
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("生成导入模板失败:", err);
    res.status(500).json({ success: false, error: "生成导入模板失败" });
  }
});

/**
 * GET /api/vehicles/violations?plateNumber=xxx — 违停详情列表
 */
router.get("/violations", async (req, res) => {
  try {
    const cid = resolveCommunityScope(req);
    if (cid === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }
    if (!cid) {
      return res.status(400).json({ success: false, error: "超管查询违停需指定小区ID" });
    }
    const communityId = cid;
    const { plateNumber } = req.query;

    if (!plateNumber) {
      return res.status(400).json({ success: false, error: "缺少车牌号" });
    }

    await ensureParkingViolationsCollection();

    const violRes = await db
      .collection("parking_violations")
      .where({ communityId, plateNumber })
      .orderBy("createdAt", "asc")
      .limit(500)
      .get();

    const list = violRes.data || [];

    // 照片 fileID 换取新的临时链接（避免过期）
    const keys = list
      .map((v) => v.photoFileID)
      .filter(
        (id) => typeof id === "string" && id.startsWith("cloud://"),
      );
    if (keys.length > 0) {
      try {
        const urlRes = await tcb.getTempFileURL({
          fileList: keys,
          maxAge: 604800, // 7天
        });
        const urlMap = {};
        (urlRes.fileList || []).forEach((f) => {
          if (f.fileID && (f.tempFileURL || f.download_url)) {
            urlMap[f.fileID] = f.download_url || f.tempFileURL;
          }
        });
        list.forEach((v) => {
          if (urlMap[v.photoFileID]) v.photoUrl = urlMap[v.photoFileID];
        });
      } catch (e) {
        console.error("刷新违停照片链接失败:", e.message);
      }
    }

    res.json({ success: true, data: list });
  } catch (err) {
    console.error("获取违停详情失败:", err);
    res.status(500).json({ success: false, error: "获取违停详情失败" });
  }
});

/**
 * POST /api/vehicles — 添加车辆
 */
router.post("/", async (req, res) => {
  try {
    const cid = resolveCommunityScope(req);
    if (cid === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }
    if (!cid) {
      return res.status(400).json({ success: false, error: "超管添加车辆需指定小区ID" });
    }
    const communityId = cid;
    const { plateNumber, ownerPhone } = req.body;

    if (!plateNumber || !ownerPhone) {
      return res
        .status(400)
        .json({ success: false, error: "车牌号和车主电话为必填项" });
    }

    // 检查本小区内车牌号唯一性
    const existing = await db
      .collection("vehicles")
      .where({ communityId, plateNumber })
      .limit(1)
      .get();
    if (existing.data && existing.data.length > 0) {
      return res
        .status(400)
        .json({ success: false, error: "该车牌号在本小区已存在" });
    }

    const now = new Date().toISOString();
    const vehicleData = {
      communityId,
      vehicleType: req.body.vehicleType || "",
      plateNumber,
      ownerName: req.body.ownerName || "",
      ownerPhone,
      parkingFee: req.body.parkingFee || "",
      parkingSpot: req.body.parkingSpot || "",
      startDate: req.body.startDate || "",
      endDate: req.body.endDate || "",
      building: req.body.building || "",
      remark: req.body.remark || "",
      createTime: now,
      updateTime: now,
    };

    const result = await db.collection("vehicles").add(vehicleData);

    res.json({ success: true, data: { _id: result.id, ...vehicleData } });
  } catch (err) {
    console.error("添加车辆失败:", err);
    res.status(500).json({ success: false, error: "添加车辆失败" });
  }
});

/**
 * POST /api/vehicles/import — Excel 批量导入
 */
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    const cid = resolveCommunityScope(req);
    if (cid === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }
    if (!cid) {
      return res.status(400).json({ success: false, error: "超管导入车辆需指定小区ID" });
    }
    const communityId = cid;
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "请上传Excel文件" });
    }

    const wb = XLSX.read(req.file.buffer, { type: "buffer", codepage: 65001 });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let addCount = 0;
    let updateCount = 0;
    let failCount = 0;
    const failures = [];

    // 从第三行开始遍历（第一行表头，第二行示例）
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1; // Excel 中的行号（1-based）

      // 列映射：0-车辆类型, 1-车牌号, 2-车主姓名, 3-车主电话, 4-车位费,
      //          5-车位编号, 6-有效开始日期, 7-有效结束日期, 8-栋单元房号, 9-备注
      const vehicleType = row[0] ? String(row[0]).trim() : "";
      const plateNumber = row[1] ? String(row[1]).trim() : "";
      const ownerName = row[2] ? String(row[2]).trim() : "";
      const ownerPhone = row[3] ? String(row[3]).trim() : "";
      const parkingFee = row[4] ? String(row[4]).trim() : "";
      const parkingSpot = row[5] ? String(row[5]).trim() : "";
      const startDate = row[6] ? String(row[6]).trim() : "";
      const endDate = row[7] ? String(row[7]).trim() : "";
      const building = row[8] ? String(row[8]).trim() : "";
      const remark = row[9] ? String(row[9]).trim() : "";

      // 校验必填项
      if (!plateNumber) {
        failCount++;
        failures.push({ row: rowNum, plateNumber: "", reason: "车牌号不能为空" });
        continue;
      }
      if (!ownerPhone) {
        failCount++;
        failures.push({ row: rowNum, plateNumber, reason: "车主电话不能为空" });
        continue;
      }
      if (!/^1[3-9]\d{9}$/.test(ownerPhone)) {
        failCount++;
        failures.push({ row: rowNum, plateNumber, reason: "车主电话格式不正确" });
        continue;
      }

      try {
        const existing = await db
          .collection("vehicles")
          .where({ communityId, plateNumber })
          .limit(1)
          .get();

        const now = new Date().toISOString();
        const vehicleData = {
          vehicleType,
          plateNumber,
          ownerName,
          ownerPhone,
          parkingFee,
          parkingSpot,
          startDate,
          endDate,
          building,
          remark,
          updateTime: now,
        };

        if (existing.data && existing.data.length > 0) {
          await db
            .collection("vehicles")
            .doc(existing.data[0]._id)
            .update(vehicleData);
          updateCount++;
        } else {
          vehicleData.communityId = communityId;
          vehicleData.createTime = now;
          await db.collection("vehicles").add(vehicleData);
          addCount++;
        }
      } catch (e) {
        failCount++;
        failures.push({ row: rowNum, plateNumber, reason: "保存失败" });
      }
    }

    res.json({ success: true, addCount, updateCount, failCount, failures });
  } catch (err) {
    console.error("导入车辆数据失败:", err);
    res.status(500).json({ success: false, error: "导入车辆数据失败" });
  }
});

/**
 * POST /api/vehicles/batch-delete — 批量删除
 */
router.post("/batch-delete", async (req, res) => {
  try {
    const cid = resolveCommunityScope(req);
    if (cid === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }
    if (!cid) {
      return res.status(400).json({ success: false, error: "超管批量删除需指定小区ID" });
    }
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "请提供要删除的车辆ID列表" });
    }

    await db
      .collection("vehicles")
      .where({ _id: _.in(ids), communityId: cid })
      .remove();

    res.json({ success: true });
  } catch (err) {
    console.error("批量删除车辆失败:", err);
    res.status(500).json({ success: false, error: "批量删除车辆失败" });
  }
});

/**
 * PUT /api/vehicles/:id — 修改车辆
 */
router.put("/:id", async (req, res) => {
  try {
    const cid = resolveCommunityScope(req);
    if (cid === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }
    if (!cid) {
      return res.status(400).json({ success: false, error: "超管修改车辆需指定小区ID" });
    }
    const communityId = cid;
    const { id } = req.params;
    const { vehicleType, plateNumber, ownerPhone } = req.body;

    // 检查记录是否存在
    const existing = await db
      .collection("vehicles")
      .where({ _id: id, communityId })
      .limit(1)
      .get();
    if (!existing.data || existing.data.length === 0) {
      return res.status(404).json({ success: false, error: "车辆记录不存在" });
    }

    // 如果更新了车牌号，检查本小区内唯一性（排除自身）
    if (plateNumber) {
      const duplicate = await db
        .collection("vehicles")
        .where({
          communityId,
          plateNumber,
          _id: _.neq(id),
        })
        .limit(1)
        .get();
      if (duplicate.data && duplicate.data.length > 0) {
        return res
          .status(400)
          .json({ success: false, error: "该车牌号在本小区已存在" });
      }
    }

    const now = new Date().toISOString();
    const updates = { updateTime: now };

    if (vehicleType !== undefined) updates.vehicleType = vehicleType;
    if (plateNumber !== undefined) updates.plateNumber = plateNumber;
    if (req.body.ownerName !== undefined) updates.ownerName = req.body.ownerName;
    if (ownerPhone !== undefined) updates.ownerPhone = ownerPhone;
    if (req.body.parkingFee !== undefined) updates.parkingFee = req.body.parkingFee;
    if (req.body.parkingSpot !== undefined) updates.parkingSpot = req.body.parkingSpot;
    if (req.body.startDate !== undefined) updates.startDate = req.body.startDate;
    if (req.body.endDate !== undefined) updates.endDate = req.body.endDate;
    if (req.body.building !== undefined) updates.building = req.body.building;
    if (req.body.remark !== undefined) updates.remark = req.body.remark;

    await db.collection("vehicles").doc(id).update(updates);

    res.json({ success: true });
  } catch (err) {
    console.error("修改车辆失败:", err);
    res.status(500).json({ success: false, error: "修改车辆失败" });
  }
});

/**
 * DELETE /api/vehicles/:id — 删除单条车辆
 */
router.delete("/:id", async (req, res) => {
  try {
    const cid = resolveCommunityScope(req);
    if (cid === null) {
      return res.status(403).json({ success: false, error: "no_community_access" });
    }
    if (!cid) {
      return res.status(400).json({ success: false, error: "超管删除车辆需指定小区ID" });
    }
    const communityId = cid;
    const { id } = req.params;

    const existing = await db
      .collection("vehicles")
      .where({ _id: id, communityId })
      .limit(1)
      .get();
    if (!existing.data || existing.data.length === 0) {
      return res.status(404).json({ success: false, error: "车辆记录不存在" });
    }

    await db.collection("vehicles").doc(id).remove();

    res.json({ success: true });
  } catch (err) {
    console.error("删除车辆失败:", err);
    res.status(500).json({ success: false, error: "删除车辆失败" });
  }
});

module.exports = router;
