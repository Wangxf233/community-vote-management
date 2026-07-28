const express = require("express");
const router = express.Router();
const { db } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const multer = require("multer");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const _ = db.command;

const upload = multer({ storage: multer.memoryStorage() });

// 所有端点都需要认证
router.use(authMiddleware);

/**
 * 构建车辆查询条件
 */
function buildVehicleWhere(req) {
  const communityId = req.user.communityId;
  const { plateNumber, ownerName, ownerPhone } = req.query;
  const where = { communityId };

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
      { header: "有效开始日期", key: "validStartDate", width: 15 },
      { header: "有效结束日期", key: "validEndDate", width: 15 },
      { header: "栋单元房号", key: "address", width: 20 },
      { header: "备注", key: "remark", width: 20 },
    ];

    worksheet.addRows(result.data);

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
      { header: "有效开始日期", key: "validStartDate", width: 15 },
      { header: "有效结束日期", key: "validEndDate", width: 15 },
      { header: "栋单元房号", key: "address", width: 20 },
      { header: "备注", key: "remark", width: 20 },
    ];

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
 * POST /api/vehicles — 添加车辆
 */
router.post("/", async (req, res) => {
  try {
    const communityId = req.user.communityId;
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
      validStartDate: req.body.validStartDate || "",
      validEndDate: req.body.validEndDate || "",
      address: req.body.address || "",
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
    const communityId = req.user.communityId;
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

    // 从第二行开始遍历（第一行是表头）
    for (let i = 1; i < rows.length; i++) {
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
      const validStartDate = row[6] ? String(row[6]).trim() : "";
      const validEndDate = row[7] ? String(row[7]).trim() : "";
      const address = row[8] ? String(row[8]).trim() : "";
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
          validStartDate,
          validEndDate,
          address,
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
    const communityId = req.user.communityId;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "请提供要删除的车辆ID列表" });
    }

    await db
      .collection("vehicles")
      .where({ _id: _.in(ids), communityId })
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
    const communityId = req.user.communityId;
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
    if (req.body.validStartDate !== undefined) updates.validStartDate = req.body.validStartDate;
    if (req.body.validEndDate !== undefined) updates.validEndDate = req.body.validEndDate;
    if (req.body.address !== undefined) updates.address = req.body.address;
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
    const communityId = req.user.communityId;
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
