const express = require("express");
const { db } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const {
  normalizeBuilding,
  normalizeUnit,
  normalizeRoom,
} = require("../utils/helpers");

const router = express.Router();

// 所有路由都需要认证
router.use(authMiddleware);

/**
 * GET /api/owner-registry - 获取业主名册列表
 */
router.get("/owner-registry", async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const {
      name,
      district,
      building,
      unit,
      room,
      status,
      certStatus,
      realNameStatus,
    } = req.query;

    // 构建查询条件
    const query = { communityId: user.communityId };
    if (name) query.ownerName1 = new RegExp(name, "i");
    if (district) query.district = district;
    if (building) query.building = building;
    if (unit) query.unit = unit;
    if (room) query.room = room;
    if (status) query.status = status;

    const countRes = await db.collection("owner_registry").where(query).count();
    const total = countRes.total || 0;

    const list = await db
      .collection("owner_registry")
      .where(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 一次性查询两个关联集合（原来每条记录各查一次，现改为整页仅查两次）
    const [certRes, ownerRes] = await Promise.all([
      db
        .collection("certification_applications")
        .where({ communityId: user.communityId, type: "owner" })
        .get(),
      db
        .collection("owner_list")
        .where({ communityId: user.communityId })
        .get(),
    ]);

    const enrichedData = (list.data || []).map((record) => {
      let registrationStatus = "none";
      let realNameStatusValue = "unverified";

      // 在内存中匹配，因为需要规范化比较
      const matchedCert = certRes.data?.find(
        (cert) =>
          normalizeBuilding(cert.building) ===
            normalizeBuilding(record.building) &&
          normalizeUnit(cert.unit) === normalizeUnit(record.unit) &&
          normalizeRoom(cert.room) === normalizeRoom(record.room),
      );

      if (matchedCert) {
        registrationStatus = matchedCert.status || "pending";
      }

      // 在内存中匹配
      const matchedOwner = ownerRes.data?.find(
        (owner) =>
          normalizeBuilding(owner.building) ===
            normalizeBuilding(record.building) &&
          normalizeUnit(owner.unit) === normalizeUnit(record.unit) &&
          normalizeRoom(owner.room) === normalizeRoom(record.room),
      );

      if (matchedOwner) {
        realNameStatusValue = matchedOwner.realNameStatus || "unverified";
        // 只要在owner_list中存在，就说明已经通过注册认证
        registrationStatus = "approved";
      }

      return {
        ...record,
        registrationStatus,
        realNameStatusValue,
      };
    });

    // 如果有认证状态或实名状态筛选，需要在内存中过滤
    let filteredData = enrichedData;
    if (certStatus) {
      filteredData = filteredData.filter(
        (item) => item.registrationStatus === certStatus,
      );
    }
    if (realNameStatus) {
      filteredData = filteredData.filter(
        (item) => item.realNameStatusValue === realNameStatus,
      );
    }

    return res.json({
      success: true,
      data: filteredData,
      total: certStatus || realNameStatus ? filteredData.length : total,
    });
  } catch (e) {
    console.error("获取房屋清册失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/owner-registry - 添加单个业主
 */
router.post("/owner-registry", async (req, res) => {
  try {
    const user = req.user;
    const { ownerName1, ownerName2, properties, carNumber, status } = req.body;

    if (
      !ownerName1 ||
      !properties ||
      !Array.isArray(properties) ||
      properties.length === 0
    ) {
      return res.status(400).json({ success: false, error: "missing_fields" });
    }

    // 验证第一套房产的必填字段
    const firstProperty = properties[0];
    if (!firstProperty.building || !firstProperty.unit || !firstProperty.room) {
      return res
        .status(400)
        .json({ success: false, error: "缺少房产必填字段" });
    }

    // 添加所有房产
    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];

      if (!prop.building || !prop.unit || !prop.room) {
        return res
          .status(400)
          .json({ success: false, error: `第${i + 1}套房产缺少必填字段` });
      }

      // 检查是否已存在
      const existing = await db
        .collection("owner_registry")
        .where({
          communityId: user.communityId,
          building: prop.building,
          unit: prop.unit,
          room: prop.room,
        })
        .limit(1)
        .get();

      if (existing.data && existing.data.length > 0) {
        return res.status(400).json({
          success: false,
          error: `${prop.building}栋${prop.unit}单元${prop.room}室已存在`,
        });
      }

      // 只有第一套房产保存车牌号
      await db.collection("owner_registry").add({
        communityId: user.communityId,
        ownerName1,
        ownerName2: ownerName2 || "",
        district: prop.district || "",
        building: prop.building,
        unit: prop.unit,
        room: prop.room,
        carNumber: i === 0 ? carNumber || "" : "",
        area: parseFloat(prop.area) || 0,
        status: status || "valid",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("添加业主失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/owner-registry/import - 批量导入房屋清册
 */
router.post("/owner-registry/import", async (req, res) => {
  try {
    const user = req.user;
    const { data: importData } = req.body;

    if (!Array.isArray(importData) || importData.length === 0) {
      return res.status(400).json({ success: false, error: "invalid_data" });
    }

    let addCount = 0;
    let skipCount = 0;
    let failCount = 0;
    const errors = [];
    const skipped = [];

    for (const item of importData) {
      try {
        const {
          ownerName1,
          ownerName2,
          district,
          building,
          unit,
          room,
          carNumber,
          area,
          rowNumber,
          properties, // 额外的房产列表
        } = item;

        // 验证必填字段
        if (!ownerName1 || !building || !unit || !room) {
          errors.push({
            row: rowNumber,
            error: "缺少必填字段(户主姓名1、栋号、单元号、房号)",
          });
          failCount++;
          continue;
        }

        // 导入主房产记录
        const mainProperty = {
          communityId: user.communityId,
          ownerName1,
          ownerName2: ownerName2 || "",
          district: district || "",
          building: building.toString(),
          unit: unit.toString(),
          room: room.toString(),
          carNumber: carNumber || "",
          area: parseFloat(area) || 0,
          status: "valid",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // 检查主房产是否已存在
        const existing = await db
          .collection("owner_registry")
          .where({
            communityId: user.communityId,
            building: building.toString(),
            unit: unit.toString(),
            room: room.toString(),
          })
          .limit(1)
          .get();

        if (existing.data && existing.data.length > 0) {
          skipped.push({
            row: rowNumber,
            info: `${building}栋${unit}单元${room}室已存在`,
          });
          skipCount++;
        } else {
          await db.collection("owner_registry").add(mainProperty);
          addCount++;
        }

        // 导入额外的房产（如果有）
        if (properties && Array.isArray(properties) && properties.length > 0) {
          for (const prop of properties) {
            try {
              // 验证额外房产的必填字段
              if (!prop.building || !prop.unit || !prop.room) {
                errors.push({
                  row: prop.rowNumber || rowNumber,
                  error: "额外房产缺少必填字段(栋号、单元号、房号)",
                });
                failCount++;
                continue;
              }

              // 检查额外房产是否已存在
              const propExisting = await db
                .collection("owner_registry")
                .where({
                  communityId: user.communityId,
                  building: prop.building.toString(),
                  unit: prop.unit.toString(),
                  room: prop.room.toString(),
                })
                .limit(1)
                .get();

              if (propExisting.data && propExisting.data.length > 0) {
                skipped.push({
                  row: prop.rowNumber || rowNumber,
                  info: `${prop.building}栋${prop.unit}单元${prop.room}室已存在`,
                });
                skipCount++;
              } else {
                await db.collection("owner_registry").add({
                  communityId: user.communityId,
                  ownerName1,
                  ownerName2: ownerName2 || "",
                  district: prop.district || "",
                  building: prop.building.toString(),
                  unit: prop.unit.toString(),
                  room: prop.room.toString(),
                  carNumber: "", // 车牌号统一在主记录上
                  area: parseFloat(prop.area) || 0,
                  status: "valid",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
                addCount++;
              }
            } catch (propErr) {
              errors.push({
                row: prop.rowNumber || rowNumber,
                error: propErr.message || "导入额外房产失败",
              });
              failCount++;
            }
          }
        }
      } catch (err) {
        errors.push({
          row: item.rowNumber,
          error: err.message || "导入失败",
        });
        failCount++;
      }
    }

    return res.json({
      success: true,
      addCount,
      skipCount,
      failCount,
      errors,
      skipped,
    });
  } catch (e) {
    console.error("批量导入失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PUT /api/owner-registry/:id - 更新业主信息
 */
router.put("/owner-registry/:id", async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { ownerName1, ownerName2, properties, carNumber, status } = req.body;

    if (!properties || !Array.isArray(properties) || properties.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "missing_properties" });
    }

    // 获取原记录
    const original = await db.collection("owner_registry").doc(id).get();
    if (!original.data || original.data.length === 0) {
      return res.status(404).json({ success: false, error: "记录不存在" });
    }

    const originalData = original.data[0];

    // 先删除所有相同户主的记录（除了正在编辑的这条）
    const sameOwnerRecords = await db
      .collection("owner_registry")
      .where({
        communityId: user.communityId,
        ownerName1: originalData.ownerName1,
        ownerName2: originalData.ownerName2 || "",
      })
      .get();

    for (const record of sameOwnerRecords.data || []) {
      if (record._id !== id) {
        await db.collection("owner_registry").doc(record._id).remove();
      }
    }

    // 更新第一套房产（使用原记录ID）
    const firstProperty = properties[0];
    await db
      .collection("owner_registry")
      .doc(id)
      .update({
        data: {
          ownerName1,
          ownerName2: ownerName2 || "",
          district: firstProperty.district || "",
          building: firstProperty.building,
          unit: firstProperty.unit,
          room: firstProperty.room,
          carNumber: carNumber || "",
          area: parseFloat(firstProperty.area) || 0,
          status: status || "valid",
          updatedAt: new Date().toISOString(),
        },
      });

    // 添加其他房产
    for (let i = 1; i < properties.length; i++) {
      const prop = properties[i];
      await db.collection("owner_registry").add({
        communityId: user.communityId,
        ownerName1,
        ownerName2: ownerName2 || "",
        district: prop.district || "",
        building: prop.building,
        unit: prop.unit,
        room: prop.room,
        carNumber: "",
        area: parseFloat(prop.area) || 0,
        status: status || "valid",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("更新业主失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * DELETE /api/owner-registry/:id - 删除业主
 */
router.delete("/owner-registry/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("owner_registry").doc(id).remove();
    return res.json({ success: true });
  } catch (e) {
    console.error("删除业主失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * GET /api/owner-list - 获取户主名单列表
 */
router.get("/owner-list", async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { name, district, building, unit, room, carNumber, realNameStatus } =
      req.query;

    const query = { communityId: user.communityId };
    if (name) query.name = new RegExp(name, "i");
    if (district) query.district = district;
    if (building) query.building = building;
    if (unit) query.unit = unit;
    if (room) query.room = room;
    if (carNumber) query.carNumber = new RegExp(carNumber, "i");
    // 暂时不在数据库层面过滤 realNameStatus，因为可能需要从 owner_registry 补充

    const countRes = await db.collection("owner_list").where(query).count();
    const total = countRes.total || 0;

    const list = await db
      .collection("owner_list")
      .where(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 为每条记录补充实名认证信息（如果 owner_list 中没有，从 owner_registry 获取）
    const enrichedList = await Promise.all(
      (list.data || []).map(async (owner) => {
        // 如果已有实名认证信息，直接返回
        if (owner.realNameStatus && owner.realNameStatus !== "unverified") {
          return owner;
        }

        // 否则尝试从 owner_registry 获取
        try {
          const ownerRegRes = await db
            .collection("owner_registry")
            .where({
              communityId: user.communityId,
            })
            .get();

          const matchedReg = ownerRegRes.data?.find(
            (reg) =>
              normalizeBuilding(reg.building) ===
                normalizeBuilding(owner.building) &&
              normalizeUnit(reg.unit) === normalizeUnit(owner.unit) &&
              normalizeRoom(reg.room) === normalizeRoom(owner.room) &&
              (reg.ownerName1 === owner.name || reg.ownerName2 === owner.name),
          );

          if (
            matchedReg &&
            matchedReg.realNameStatus &&
            matchedReg.realNameStatus !== "unverified"
          ) {
            // 合并 owner_registry 的实名认证信息
            return {
              ...owner,
              realNameStatus: matchedReg.realNameStatus,
              realNameIdCardFront: matchedReg.realNameIdCardFront || "",
              realNameIdCardBack: matchedReg.realNameIdCardBack || "",
              realNameCertType: matchedReg.realNameCertType || "",
              realNameCertImage: matchedReg.realNameCertImage || "",
              realNameSubmitTime: matchedReg.realNameSubmitTime || "",
              realNameRejectReason: matchedReg.realNameRejectReason || "",
            };
          }
        } catch (err) {
          console.error("从 owner_registry 查询实名认证失败:", err);
        }

        return owner;
      }),
    );

    // 应用实名状态筛选（在内存中过滤）
    let filteredList = enrichedList;
    if (realNameStatus) {
      filteredList = enrichedList.filter(
        (owner) => (owner.realNameStatus || "unverified") === realNameStatus,
      );
    }

    return res.json({
      success: true,
      data: filteredList,
      total: realNameStatus ? filteredList.length : total,
    });
  } catch (e) {
    console.error("获取户主名单失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PUT /api/owner-list/:id - 修改户主信息（支持多房产）
 */
router.put("/owner-list/:id", async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { name, phone, properties, carNumber } = req.body;

    // 1. 获取当前记录以保留重要字段
    const currentRecord = await db.collection("owner_list").doc(id).get();
    if (!currentRecord.data || currentRecord.data.length === 0) {
      return res.status(404).json({ success: false, error: "记录不存在" });
    }

    const record = currentRecord.data[0];
    const preservedFields = {
      openid: record.openid,
      realNameStatus: record.realNameStatus || "unverified",
      realNameSubmitTime: record.realNameSubmitTime,
      realNameIdCardFront: record.realNameIdCardFront,
      realNameIdCardBack: record.realNameIdCardBack,
      realNameCertType: record.realNameCertType,
      realNameCertImage: record.realNameCertImage,
      realNameRejectReason: record.realNameRejectReason,
    };

    // 2. 查询该户主的所有其他房产记录（通过原始姓名和手机号）
    const oldName = record.name;
    const oldPhone = record.phone;

    const allRecords = await db
      .collection("owner_list")
      .where({
        name: oldName,
        phone: oldPhone,
        communityId: user.communityId,
      })
      .get();

    // 3. 删除所有旧记录
    if (allRecords.data && allRecords.data.length > 0) {
      const deletePromises = allRecords.data.map((rec) =>
        db.collection("owner_list").doc(rec._id).remove(),
      );
      await Promise.all(deletePromises);
    }

    // 4. 创建所有新的房产记录
    if (properties && properties.length > 0) {
      const addPromises = properties.map((property) => {
        const newRecord = {
          communityId: user.communityId,
          name,
          phone,
          building: property.building,
          unit: property.unit,
          room: property.room,
          area: property.area || "",
          remark: property.remark || "",
          carNumber: carNumber || "",
          ...preservedFields,
          createdAt: record.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return db.collection("owner_list").add(newRecord);
      });

      await Promise.all(addPromises);
    }

    // 5. 同步该户主的投票记录（专有面积等随户主名单变更）
    try {
      const newProperties = properties || [];
      const primary = newProperties[0] || {};
      // 专有面积取该户主所有房产之和
      const totalArea = parseFloat(
        newProperties
          .reduce((sum, p) => sum + (parseFloat(p.area) || 0), 0)
          .toFixed(2)
      );
      const voteWhere = { communityId: user.communityId };
      if (record.openid && String(record.openid).trim()) {
        voteWhere.openid = String(record.openid).trim();
      } else {
        // 无 openid 时按编辑前的姓名+手机号匹配（投票记录中保存的是投票时的快照）
        voteWhere.ownerName = oldName;
        voteWhere.ownerPhone = oldPhone;
      }

      const voteRecordsRes = await db
        .collection("vote_records")
        .where(voteWhere)
        .get();

      const updatePromises = (voteRecordsRes.data || []).map((vr) =>
        db.collection("vote_records").doc(vr._id).update({
          data: {
            area: totalArea,
            ownerName: name,
            ownerPhone: phone,
            building: primary.building || "",
            unit: primary.unit || "",
            room: primary.room || "",
            properties: newProperties.map((p) => ({
              district: p.district || "",
              building: p.building || "",
              unit: p.unit || "",
              room: p.room || "",
              area: p.area || 0,
            })),
            updatedAt: new Date().toISOString(),
          },
        })
      );
      await Promise.all(updatePromises);
    } catch (syncErr) {
      // 投票记录同步失败不影响户主信息修改本身
      console.error("同步投票记录失败:", syncErr);
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("修改户主信息失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * DELETE /api/owner-list/:id - 删除户主
 */
router.delete("/owner-list/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 先获取户主信息
    const ownerRes = await db.collection("owner_list").doc(id).get();
    if (!ownerRes || !ownerRes.data || ownerRes.data.length === 0) {
      return res.status(404).json({ success: false, error: "户主不存在" });
    }

    const owner = ownerRes.data[0];
    const { name, phone, communityId } = owner;

    // 删除该户主的所有房产记录（同一户主可能有多套房产）
    const allOwnersRes = await db
      .collection("owner_list")
      .where({
        name: name,
        phone: phone,
        communityId: communityId,
      })
      .get();

    if (allOwnersRes && allOwnersRes.data && allOwnersRes.data.length > 0) {
      for (const ownerRecord of allOwnersRes.data) {
        await db.collection("owner_list").doc(ownerRecord._id).remove();
      }
    }

    // 删除对应的认证申请记录（通过手机号或openid查询）
    try {
      // 通过手机号查询
      if (phone) {
        const certByPhoneRes = await db
          .collection("certification_applications")
          .where({
            phone: phone,
            communityId: communityId,
          })
          .get();

        if (
          certByPhoneRes &&
          certByPhoneRes.data &&
          certByPhoneRes.data.length > 0
        ) {
          for (const cert of certByPhoneRes.data) {
            await db
              .collection("certification_applications")
              .doc(cert._id)
              .remove();
          }
        }
      }

      // 通过 openid 查询（如果有）
      if (owner.openid) {
        const certByOpenidRes = await db
          .collection("certification_applications")
          .where({
            openid: owner.openid,
            communityId: owner.communityId,
          })
          .get();

        if (
          certByOpenidRes &&
          certByOpenidRes.data &&
          certByOpenidRes.data.length > 0
        ) {
          for (const cert of certByOpenidRes.data) {
            await db
              .collection("certification_applications")
              .doc(cert._id)
              .remove();
          }
        }
      }
    } catch (certError) {
      console.error("删除认证申请记录失败:", certError);
    }

    // 将实名认证信息保存到 owner_registry（以便用户重新注册时恢复）
    try {
      // 只保存有实名认证信息的户主
      if (owner.realNameStatus && owner.realNameStatus !== "unverified") {
        // 查询整个小区的 owner_registry 记录
        const ownerRegRes = await db
          .collection("owner_registry")
          .where({
            communityId: communityId,
          })
          .get();

        // 在内存中过滤匹配的记录
        const matchedRecords = ownerRegRes.data
          ? ownerRegRes.data.filter(
              (reg) =>
                normalizeBuilding(reg.building) ===
                  normalizeBuilding(owner.building) &&
                normalizeUnit(reg.unit) === normalizeUnit(owner.unit) &&
                normalizeRoom(reg.room) === normalizeRoom(owner.room) &&
                (reg.ownerName1 === name || reg.ownerName2 === name),
            )
          : [];

        if (matchedRecords.length > 0) {
          for (const reg of matchedRecords) {
            await db
              .collection("owner_registry")
              .doc(reg._id)
              .update({
                data: {
                  realNameStatus: owner.realNameStatus,
                  realNameIdCardFront: owner.realNameIdCardFront || "",
                  realNameIdCardBack: owner.realNameIdCardBack || "",
                  realNameCertType: owner.realNameCertType || "",
                  realNameCertImage: owner.realNameCertImage || "",
                  realNameSubmitTime: owner.realNameSubmitTime || "",
                  realNameRejectReason: owner.realNameRejectReason || "",
                  updatedAt: new Date().toISOString(),
                },
              });
          }
        }
      }
    } catch (regError) {
      console.error("保存实名认证数据到owner_registry失败:", regError);
    }

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/owner-list/:id/verify - 提交房屋实名认证
 */
router.post("/owner-list/:id/verify", async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .collection("owner_list")
      .doc(id)
      .update({
        data: {
          realNameStatus: "pending",
          updatedAt: new Date().toISOString(),
        },
      });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * GET /api/owner-list/:id/realname - 获取户主实名认证信息
 */
router.get("/owner-list/:id/realname", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.collection("owner_list").doc(id).get();

    if (!result.data || result.data.length === 0) {
      return res.status(404).json({ success: false, error: "未找到户主信息" });
    }

    const owner = result.data[0];

    // 构建返回数据（优先使用 owner_list 中的数据）
    let realNameData = {
      realNameStatus: owner.realNameStatus || "unverified",
      realNameIdCardFront: owner.realNameIdCardFront || "",
      realNameIdCardBack: owner.realNameIdCardBack || "",
      realNameCertType: owner.realNameCertType || "",
      realNameCertImage: owner.realNameCertImage || "",
      realNameSubmitTime: owner.realNameSubmitTime || "",
      realNameRejectReason: owner.realNameRejectReason || "",
    };

    // 如果 owner_list 中没有实名认证信息，尝试从 owner_registry 获取
    if (
      !realNameData.realNameStatus ||
      realNameData.realNameStatus === "unverified"
    ) {
      try {
        const ownerRegRes = await db
          .collection("owner_registry")
          .where({
            communityId: owner.communityId,
          })
          .get();

        // 在内存中查找匹配的记录
        const matchedReg = ownerRegRes.data?.find(
          (reg) =>
            normalizeBuilding(reg.building) ===
              normalizeBuilding(owner.building) &&
            normalizeUnit(reg.unit) === normalizeUnit(owner.unit) &&
            normalizeRoom(reg.room) === normalizeRoom(owner.room) &&
            (reg.ownerName1 === owner.name || reg.ownerName2 === owner.name),
        );

        if (
          matchedReg &&
          matchedReg.realNameStatus &&
          matchedReg.realNameStatus !== "unverified"
        ) {
          // 从 owner_registry 中恢复实名认证信息
          realNameData = {
            realNameStatus: matchedReg.realNameStatus,
            realNameIdCardFront: matchedReg.realNameIdCardFront || "",
            realNameIdCardBack: matchedReg.realNameIdCardBack || "",
            realNameCertType: matchedReg.realNameCertType || "",
            realNameCertImage: matchedReg.realNameCertImage || "",
            realNameSubmitTime: matchedReg.realNameSubmitTime || "",
            realNameRejectReason: matchedReg.realNameRejectReason || "",
          };
        }
      } catch (regError) {
        console.error("从 owner_registry 查询实名认证信息失败:", regError);
      }
    }

    // 返回实名认证相关字段
    return res.json({
      success: true,
      data: realNameData,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/owner-list/:id/realname-review - 审核户主实名认证
 */
router.post("/owner-list/:id/realname-review", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectReason } = req.body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, error: "无效的审核状态" });
    }

    const updateData = {
      realNameStatus: status === "approved" ? "verified" : "rejected",
      updatedAt: new Date().toISOString(),
    };

    if (status === "rejected") {
      updateData.realNameRejectReason = rejectReason || "审核未通过";
    } else {
      updateData.realNameRejectReason = "";
    }

    // 先获取 owner_list 记录
    const ownerRes = await db.collection("owner_list").doc(id).get();

    if (!ownerRes.data || ownerRes.data.length === 0) {
      return res.status(404).json({ success: false, error: "未找到户主信息" });
    }

    const owner = ownerRes.data[0];

    // 更新 owner_list
    await db.collection("owner_list").doc(id).update(updateData);

    // 同时更新 owner_registry（通过房号信息查找）
    if (owner.communityId && owner.building && owner.unit && owner.room) {
      const ownerRegRes = await db
        .collection("owner_registry")
        .where({
          communityId: owner.communityId,
          building: owner.building,
          unit: owner.unit,
          room: owner.room,
        })
        .get();

      if (ownerRegRes.data && ownerRegRes.data.length > 0) {
        for (const ownerReg of ownerRegRes.data) {
          await db
            .collection("owner_registry")
            .doc(ownerReg._id)
            .update(updateData);
        }
      }
    }

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/owner-registry/:id/realname-review - 审核业主实名认证
 */
router.post("/owner-registry/:id/realname-review", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectReason } = req.body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, error: "无效的审核状态" });
    }

    const updateData = {
      realNameStatus: status === "approved" ? "verified" : "rejected",
      updatedAt: new Date().toISOString(),
    };

    if (status === "rejected") {
      updateData.realNameRejectReason = rejectReason || "审核未通过";
    } else {
      updateData.realNameRejectReason = "";
    }

    // 先获取 owner_registry 记录以获取 openid
    const ownerReg = await db.collection("owner_registry").doc(id).get();

    // 更新 owner_registry
    await db.collection("owner_registry").doc(id).update(updateData);

    // 同时更新 owner_list（如果记录存在）
    if (ownerReg.data && ownerReg.data.length > 0) {
      const owner = ownerReg.data[0];
      if (owner.openid) {
        const ownerListRes = await db
          .collection("owner_list")
          .where({
            openid: owner.openid,
          })
          .get();

        if (ownerListRes.data && ownerListRes.data.length > 0) {
          const ownerListId = ownerListRes.data[0]._id;
          await db.collection("owner_list").doc(ownerListId).update(updateData);
        }
      }
    }

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

module.exports = router;
