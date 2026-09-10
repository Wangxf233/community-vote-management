const express = require("express");
const { db } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
const _ = db.command;

// 所有路由都需要认证
router.use(authMiddleware);

/**
 * 商铺业务接口总览（与房屋业务完全隔离，房屋接口见 owner.js / house.js）：
 * 1. 商铺配置:    GET/POST /api/shop-config                      （shop_config 集合）
 * 2. 商铺认证申请: GET /api/shop-certification-applications       （shop_certification_applications 集合）
 *               POST /api/shop-certification-applications/:id/review —— 审核通过时
 *                 自动把商铺名册(shop_registry)中的专有面积、备注同步到商铺户主名单(shop_owner_list)
 *               DELETE /api/shop-certification-applications/:id
 * 3. 商铺名册:    GET/POST /api/shop-registry + /import + PUT/DELETE /:id + POST /:id/realname-review
 * 4. 商铺户主名单: GET /api/shop-owner-list + PUT/DELETE /:id + GET /:id/realname + POST /:id/realname-review
 *
 * 状态枚举全部复用房屋业务已有枚举：
 * - 导入状态 status: "valid" | "invalid"
 * - 注册认证状态: "pending" | "approved" | "rejected"（派生值另有 "none"）
 * - 实名状态 realNameStatus: "unverified" | "pending" | "verified" | "rejected"
 *
 * 多租户隔离：所有 /:id 写操作均先校验文档 communityId 与当前管理员一致。
 */

/**
 * 转义正则特殊字符，防止用户输入的搜索文本导致 RegExp 构造失败（500）
 */
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============ 商铺配置 ============

/**
 * GET /api/shop-config - 获取商铺配置
 * 门牌号与商铺名一一对应，返回成对列表：[{ houseNumber, shopName }]，两项均选填
 */
router.get("/shop-config", async (req, res) => {
  try {
    const user = req.user;

    const configRes = await db
      .collection("shop_config")
      .where({ communityId: user.communityId })
      .limit(1)
      .get();

    const config =
      configRes.data && configRes.data[0] ? configRes.data[0] : null;

    // 兼容旧结构（houseNumbers/shopNames 两个独立数组），转换为一一对应的商铺对
    let shops = [];
    if (config && Array.isArray(config.shops)) {
      shops = config.shops
        .filter((s) => s && (s.houseNumber || s.shopName))
        .map((s) => ({
          houseNumber: s.houseNumber || "",
          shopName: s.shopName || "",
        }));
    } else if (config) {
      const houseNumbers = config.houseNumbers || [];
      const shopNames = config.shopNames || [];
      const maxLen = Math.max(houseNumbers.length, shopNames.length);
      for (let i = 0; i < maxLen; i++) {
        shops.push({
          houseNumber: houseNumbers[i] || "",
          shopName: shopNames[i] || "",
        });
      }
    }

    return res.json({
      success: true,
      config: { shops },
    });
  } catch (e) {
    console.error("获取商铺配置失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/shop-config - 保存商铺配置
 * 门牌号与商铺名一一对应，body: { shops: [{ houseNumber, shopName }] }
 * 每行两个字段均选填，全空的行自动丢弃
 */
router.post("/shop-config", async (req, res) => {
  try {
    const user = req.user;
    const { shops, houseNumbers, shopNames } = req.body;

    const clean = (v) =>
      v === null || v === undefined ? "" : String(v).trim();

    let shopRows = [];
    if (Array.isArray(shops)) {
      // 新结构：成对行
      shopRows = shops
        .filter((s) => s && typeof s === "object")
        .map((s) => ({
          houseNumber: clean(s.houseNumber),
          shopName: clean(s.shopName),
        }))
        .filter((s) => s.houseNumber || s.shopName);
    } else if (Array.isArray(houseNumbers) || Array.isArray(shopNames)) {
      // 兼容旧版两个独立数组入参（按下标一一配对）
      const hList = Array.isArray(houseNumbers) ? houseNumbers : [];
      const sList = Array.isArray(shopNames) ? shopNames : [];
      const maxLen = Math.max(hList.length, sList.length);
      for (let i = 0; i < maxLen; i++) {
        const houseNumber = clean(hList[i]);
        const shopName = clean(sList[i]);
        if (houseNumber || shopName) {
          shopRows.push({ houseNumber, shopName });
        }
      }
    }

    const now = new Date().toISOString();

    const existingRes = await db
      .collection("shop_config")
      .where({ communityId: user.communityId })
      .limit(1)
      .get();

    if (existingRes.data && existingRes.data.length > 0) {
      // 更新（@cloudbase/node-sdk 的 update 直接收字段对象，不带 { data } 包装）
      await db
        .collection("shop_config")
        .doc(existingRes.data[0]._id)
        .update({
          shops: shopRows,
          updatedAt: now,
        });
    } else {
      // 新增
      await db.collection("shop_config").add({
        communityId: user.communityId,
        shops: shopRows,
        createdAt: now,
        updatedAt: now,
      });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("保存商铺配置失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// ============ 商铺认证申请 ============

/**
 * GET /api/shop-certification-applications - 获取商铺认证申请列表
 */
router.get("/shop-certification-applications", async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { name, houseNumber, shopName, status } = req.query;

    const query = { communityId: user.communityId };

    // 只显示待审核和已拒绝的申请，不显示已通过和已删除的
    if (status && (status === "pending" || status === "rejected")) {
      query.status = status;
    } else {
      query.status = _.nin(["approved", "removed"]);
    }

    if (name) query.name = new RegExp(escapeRegExp(name), "i");
    if (houseNumber) query.houseNumber = houseNumber;
    if (shopName) query.shopName = shopName;

    const countRes = await db
      .collection("shop_certification_applications")
      .where(query)
      .count();
    const total = countRes.total || 0;

    const list = await db
      .collection("shop_certification_applications")
      .where(query)
      .orderBy("createdAt", "desc")
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return res.json({
      success: true,
      data: list.data || [],
      total,
    });
  } catch (e) {
    console.error("获取商铺认证申请列表失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/shop-certification-applications/:id/review - 审核商铺认证申请
 *
 * 核心数据流转：审核通过后，自动把商铺名册(shop_registry)中的专有面积、备注
 * 同步带到商铺户主名单(shop_owner_list)对应记录。
 * 先同步、后更新申请状态；同步失败时不改状态，管理员可重试。
 */
router.post("/shop-certification-applications/:id/review", async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { action, reason } = req.body;

    if (!["approved", "rejected"].includes(action)) {
      return res
        .status(400)
        .json({ success: false, error: "invalid_action" });
    }

    // 先读取申请，校验小区归属（多租户隔离）
    const appRes = await db
      .collection("shop_certification_applications")
      .doc(id)
      .get();
    const app = appRes.data && appRes.data[0];

    if (!app) {
      return res.status(404).json({ success: false, error: "申请不存在" });
    }
    if (app.communityId !== user.communityId) {
      return res
        .status(403)
        .json({ success: false, error: "无权操作该申请" });
    }
    if (app.status === "removed") {
      return res.status(404).json({ success: false, error: "申请已被删除" });
    }
    // 重复审核保护：已通过的申请再次审核直接返回成功（幂等），避免重复写入户主名单
    if (app.status === "approved") {
      return res.json({ success: true });
    }

    // 审核通过：先把申请信息（含名册中的专有面积、备注）同步到商铺户主名单
    if (action === "approved") {
      // 查询商铺名册中该用户的所有商铺（ownerName1 或 ownerName2 匹配即可）
      const shopRegistryRes = await db
        .collection("shop_registry")
        .where(
          _.and([
            { communityId: app.communityId },
            _.or([{ ownerName1: app.name }, { ownerName2: app.name }]),
          ]),
        )
        .get();

      const matchedShops = shopRegistryRes.data || [];
      const now = new Date().toISOString();

      // 商铺名册无匹配时，仅同步申请本身携带的商铺信息（统一走同一套同步逻辑）
      const shopsToSync =
        matchedShops.length > 0
          ? matchedShops
          : [
              {
                houseNumber: app.houseNumber || "",
                shopName: app.shopName || "",
                area: 0,
                remark: app.remark || "",
              },
            ];

      for (const shop of shopsToSync) {
        // 检查该商铺是否已存在于商铺户主名单中（避免重复审批产生重复记录）
        const existingOwner = await db
          .collection("shop_owner_list")
          .where({
            communityId: app.communityId,
            name: app.name,
            houseNumber: shop.houseNumber || "",
            shopName: shop.shopName || "",
          })
          .limit(1)
          .get();

        if (existingOwner.data && existingOwner.data.length > 0) {
          // 该商铺已存在，跳过
          continue;
        }

        // 添加到商铺户主名单，同步专有面积、备注，并从 shop_registry 恢复实名认证信息
        const newOwner = {
          communityId: app.communityId,
          name: app.name,
          phone: app.phone,
          houseNumber: shop.houseNumber || "",
          shopName: shop.shopName || "",
          // 专有面积、备注从商铺名册同步带入
          area: parseFloat(shop.area) || 0,
          remark: shop.remark || "",
          openid: app.openid || "",
          realNameStatus: "unverified",
          createdAt: now,
          updatedAt: now,
        };

        // 从 shop_registry 恢复实名认证信息（如果存在）
        if (shop.realNameStatus && shop.realNameStatus !== "unverified") {
          newOwner.realNameStatus = shop.realNameStatus;
          newOwner.realNameIdCardFront = shop.realNameIdCardFront || "";
          newOwner.realNameIdCardBack = shop.realNameIdCardBack || "";
          newOwner.realNameCertType = shop.realNameCertType || "";
          newOwner.realNameCertImage = shop.realNameCertImage || "";
          newOwner.realNameSubmitTime = shop.realNameSubmitTime || "";
          newOwner.realNameRejectReason = shop.realNameRejectReason || "";
        }

        try {
          await db.collection("shop_owner_list").add(newOwner);
        } catch (addErr) {
          console.error("添加到商铺户主名单失败:", addErr);
          // 同步失败时不更新申请状态，管理员可重试审核
          return res
            .status(500)
            .json({ success: false, error: "同步户主名单失败，请重试" });
        }
      }
    }

    // 同步完成后再更新申请状态
    const updateData = {
      status: action,
      reviewedAt: new Date().toISOString(),
      reviewedBy: user._id,
      updatedAt: new Date().toISOString(),
    };

    if (action === "rejected") {
      updateData.rejectReason = reason || "";
    }

    await db
      .collection("shop_certification_applications")
      .doc(id)
      .update(updateData);

    // 注：门禁系统暂无商铺角色逻辑，商铺审核通过暂不自动分配门禁权限
    return res.json({ success: true });
  } catch (e) {
    console.error("商铺认证审核失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * DELETE /api/shop-certification-applications/:id - 删除商铺认证申请
 */
router.delete("/shop-certification-applications/:id", async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    // 校验小区归属
    const appRes = await db
      .collection("shop_certification_applications")
      .doc(id)
      .get();
    const app = appRes.data && appRes.data[0];
    if (!app) {
      return res.status(404).json({ success: false, error: "申请不存在" });
    }
    if (app.communityId !== user.communityId) {
      return res
        .status(403)
        .json({ success: false, error: "无权操作该申请" });
    }

    await db.collection("shop_certification_applications").doc(id).remove();
    return res.json({ success: true });
  } catch (e) {
    console.error("删除商铺认证申请失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// ============ 商铺名册（业主名册-商铺） ============

/**
 * GET /api/shop-registry - 获取商铺名册列表
 * 商铺数量少：一次性拉取全部基础记录 → 状态增强 → 内存筛选 → 内存分页，
 * 保证状态筛选结果跨页可见且 total 准确。
 */
router.get("/shop-registry", async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const {
      name,
      houseNumber,
      shopName,
      status,
      certStatus,
      realNameStatus,
    } = req.query;

    // 构建查询条件
    const query = { communityId: user.communityId };
    if (name) query.ownerName1 = new RegExp(escapeRegExp(name), "i");
    if (houseNumber) query.houseNumber = houseNumber;
    if (shopName) query.shopName = shopName;
    if (status) query.status = status;

    const listRes = await db
      .collection("shop_registry")
      .where(query)
      .limit(1000)
      .get();

    // 一次性查询两个关联集合（同 owner-registry 的整页批量查询模式）
    // limit(1000) 避免 SDK 默认 100 条截断导致状态匹配静默丢失
    const [certRes, ownerRes] = await Promise.all([
      db
        .collection("shop_certification_applications")
        .where({ communityId: user.communityId })
        .limit(1000)
        .get(),
      db
        .collection("shop_owner_list")
        .where({ communityId: user.communityId })
        .limit(1000)
        .get(),
    ]);

    const enrichedData = (listRes.data || []).map((record) => {
      let registrationStatus = "none";
      let realNameStatusValue = "unverified";

      // 门牌号/商铺名均为空时不参与匹配（避免空值互相误匹配）
      const canMatch = !!(record.houseNumber || record.shopName);

      if (canMatch) {
        // 匹配商铺认证申请，得出注册认证状态
        const matchedCert = certRes.data?.find(
          (cert) =>
            cert.houseNumber === record.houseNumber &&
            cert.shopName === record.shopName,
        );

        if (matchedCert) {
          registrationStatus = matchedCert.status || "pending";
        }

        // 匹配商铺户主名单，得出实名状态；只要在名单中即视为已通过注册认证
        const matchedOwner = ownerRes.data?.find(
          (owner) =>
            owner.houseNumber === record.houseNumber &&
            owner.shopName === record.shopName,
        );

        if (matchedOwner) {
          realNameStatusValue = matchedOwner.realNameStatus || "unverified";
          registrationStatus = "approved";
        }
      }

      return {
        ...record,
        registrationStatus,
        realNameStatusValue,
      };
    });

    // 认证状态或实名状态筛选在内存中过滤（在全量数据上过滤，避免分页后过滤导致跨页数据丢失）
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

    // 内存分页
    const total = filteredData.length;
    const start = (page - 1) * pageSize;
    const pagedData = filteredData.slice(start, start + pageSize);

    return res.json({
      success: true,
      data: pagedData,
      total,
    });
  } catch (e) {
    console.error("获取商铺名册失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/shop-registry - 手动添加商铺记录
 * 必填：户主姓名、专有面积；选填：门牌号、商铺名、备注
 */
router.post("/shop-registry", async (req, res) => {
  try {
    const user = req.user;
    const { ownerName1, houseNumber, shopName, area, remark, status } =
      req.body;

    if (!ownerName1) {
      return res
        .status(400)
        .json({ success: false, error: "户主姓名必填" });
    }
    if (area === undefined || area === null || String(area).trim() === "") {
      return res
        .status(400)
        .json({ success: false, error: "专有面积必填" });
    }

    const houseNumberStr = (houseNumber || "").toString();
    const shopNameStr = (shopName || "").toString();

    // 检查是否已存在（同户主+同门牌号+同商铺名）
    const existing = await db
      .collection("shop_registry")
      .where({
        communityId: user.communityId,
        ownerName1,
        houseNumber: houseNumberStr,
        shopName: shopNameStr,
      })
      .limit(1)
      .get();

    if (existing.data && existing.data.length > 0) {
      return res
        .status(400)
        .json({ success: false, error: "该商铺记录已存在" });
    }

    await db.collection("shop_registry").add({
      communityId: user.communityId,
      ownerName1,
      ownerName2: "",
      houseNumber: houseNumberStr,
      shopName: shopNameStr,
      area: parseFloat(area) || 0,
      remark: remark || "",
      status: status || "valid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return res.json({ success: true });
  } catch (e) {
    console.error("添加商铺失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/shop-registry/import - 批量导入商铺名册
 * 导入模板字段：户主姓名【必填】、门牌号【选填】、商铺名【选填】、专有面积【必填】、备注【选填】
 * 商铺数量少、结构扁平，每行一条记录，无多房产合并逻辑
 */
router.post("/shop-registry/import", async (req, res) => {
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
          houseNumber,
          shopName,
          area,
          remark,
          rowNumber,
        } = item;

        // 验证必填字段：户主姓名、专有面积
        if (!ownerName1) {
          errors.push({
            row: rowNumber,
            error: "缺少必填字段(户主姓名)",
          });
          failCount++;
          continue;
        }
        if (
          area === undefined ||
          area === null ||
          String(area).trim() === ""
        ) {
          errors.push({
            row: rowNumber,
            error: "缺少必填字段(专有面积)",
          });
          failCount++;
          continue;
        }

        const houseNumberStr = (houseNumber || "").toString();
        const shopNameStr = (shopName || "").toString();

        // 检查是否已存在（同户主+同门牌号+同商铺名）
        const existing = await db
          .collection("shop_registry")
          .where({
            communityId: user.communityId,
            ownerName1: ownerName1.toString(),
            houseNumber: houseNumberStr,
            shopName: shopNameStr,
          })
          .limit(1)
          .get();

        if (existing.data && existing.data.length > 0) {
          skipped.push({
            row: rowNumber,
            info: `户主${ownerName1}的门牌号"${houseNumberStr || "-"}"商铺名"${shopNameStr || "-"}"已存在`,
          });
          skipCount++;
          continue;
        }

        await db.collection("shop_registry").add({
          communityId: user.communityId,
          ownerName1: ownerName1.toString(),
          ownerName2: "",
          houseNumber: houseNumberStr,
          shopName: shopNameStr,
          area: parseFloat(area) || 0,
          remark: remark || "",
          status: "valid",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        addCount++;
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
    console.error("商铺名册批量导入失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PUT /api/shop-registry/:id - 更新商铺记录
 */
router.put("/shop-registry/:id", async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { ownerName1, houseNumber, shopName, area, remark, status } =
      req.body;

    if (!ownerName1) {
      return res
        .status(400)
        .json({ success: false, error: "户主姓名必填" });
    }
    if (area === undefined || area === null || String(area).trim() === "") {
      return res
        .status(400)
        .json({ success: false, error: "专有面积必填" });
    }

    // 获取原记录并校验小区归属
    const original = await db.collection("shop_registry").doc(id).get();
    if (!original.data || original.data.length === 0) {
      return res.status(404).json({ success: false, error: "记录不存在" });
    }
    if (original.data[0].communityId !== user.communityId) {
      return res.status(403).json({ success: false, error: "无权操作该记录" });
    }

    await db
      .collection("shop_registry")
      .doc(id)
      .update({
        ownerName1,
        houseNumber: (houseNumber || "").toString(),
        shopName: (shopName || "").toString(),
        area: parseFloat(area) || 0,
        remark: remark || "",
        status: status || "valid",
        updatedAt: new Date().toISOString(),
      });

    return res.json({ success: true });
  } catch (e) {
    console.error("更新商铺失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * DELETE /api/shop-registry/:id - 删除商铺记录
 */
router.delete("/shop-registry/:id", async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    // 校验小区归属
    const original = await db.collection("shop_registry").doc(id).get();
    if (!original.data || original.data.length === 0) {
      return res.status(404).json({ success: false, error: "记录不存在" });
    }
    if (original.data[0].communityId !== user.communityId) {
      return res.status(403).json({ success: false, error: "无权操作该记录" });
    }

    await db.collection("shop_registry").doc(id).remove();
    return res.json({ success: true });
  } catch (e) {
    console.error("删除商铺失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/shop-registry/:id/realname-review - 审核商铺名册实名认证
 * 更新名册记录，并同步商铺户主名单（按小区+门牌号+商铺名匹配，全部更新）
 */
router.post("/shop-registry/:id/realname-review", async (req, res) => {
  try {
    const user = req.user;
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

    // 先获取商铺名册记录并校验小区归属
    const shopRegRes = await db.collection("shop_registry").doc(id).get();
    if (!shopRegRes.data || shopRegRes.data.length === 0) {
      return res.status(404).json({ success: false, error: "记录不存在" });
    }
    const shop = shopRegRes.data[0];
    if (shop.communityId !== user.communityId) {
      return res.status(403).json({ success: false, error: "无权操作该记录" });
    }

    // 更新商铺名册
    await db.collection("shop_registry").doc(id).update(updateData);

    // 同时更新商铺户主名单（按小区+门牌号+商铺名匹配，可能多条，全部更新）
    if (shop.communityId && (shop.houseNumber || shop.shopName)) {
      const ownerListRes = await db
        .collection("shop_owner_list")
        .where({
          communityId: shop.communityId,
          houseNumber: shop.houseNumber || "",
          shopName: shop.shopName || "",
        })
        .get();

      for (const ownerRow of ownerListRes.data || []) {
        await db
          .collection("shop_owner_list")
          .doc(ownerRow._id)
          .update(updateData);
      }
    }

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

// ============ 商铺户主名单 ============

/**
 * GET /api/shop-owner-list - 获取商铺户主名单列表
 * 商铺数量少：一次性拉取全部基础记录 → 实名信息增强 → 内存筛选 → 内存分页
 */
router.get("/shop-owner-list", async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { name, houseNumber, shopName, realNameStatus } = req.query;

    const query = { communityId: user.communityId };
    if (name) query.name = new RegExp(escapeRegExp(name), "i");
    if (houseNumber) query.houseNumber = houseNumber;
    if (shopName) query.shopName = shopName;
    // realNameStatus 数据库层不过滤，统一在内存过滤（需要名册实名信息增强后判断）

    const listRes = await db
      .collection("shop_owner_list")
      .where(query)
      .limit(1000)
      .get();

    // 一次性查询商铺名册（每页仅查一次，避免逐行 N+1 全表查询）
    let shopRegList = [];
    try {
      const shopRegRes = await db
        .collection("shop_registry")
        .where({ communityId: user.communityId })
        .limit(1000)
        .get();
      shopRegList = shopRegRes.data || [];
    } catch (err) {
      console.error("查询 shop_registry 失败:", err);
    }

    // 为每条记录补充实名认证信息（如果 shop_owner_list 中没有，从 shop_registry 获取）
    const enrichedList = (listRes.data || []).map((owner) => {
      // 如果已有实名认证信息，直接返回
      if (owner.realNameStatus && owner.realNameStatus !== "unverified") {
        return owner;
      }

      const matchedReg = shopRegList.find(
        (reg) =>
          reg.houseNumber === owner.houseNumber &&
          reg.shopName === owner.shopName &&
          (reg.ownerName1 === owner.name || reg.ownerName2 === owner.name),
      );

      if (
        matchedReg &&
        matchedReg.realNameStatus &&
        matchedReg.realNameStatus !== "unverified"
      ) {
        // 合并 shop_registry 的实名认证信息
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

      return owner;
    });

    // 实名状态筛选在全量数据上内存过滤，再分页（避免分页后过滤导致跨页数据丢失）
    let filteredList = enrichedList;
    if (realNameStatus) {
      filteredList = enrichedList.filter(
        (owner) => (owner.realNameStatus || "unverified") === realNameStatus,
      );
    }

    // 内存分页
    const total = filteredList.length;
    const start = (page - 1) * pageSize;
    const pagedData = filteredList.slice(start, start + pageSize);

    return res.json({
      success: true,
      data: pagedData,
      total,
    });
  } catch (e) {
    console.error("获取商铺户主名单失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PUT /api/shop-owner-list/:id - 修改商铺户主信息
 * 商铺记录扁平（一条 = 一个商铺），无多房产合并逻辑
 */
router.put("/shop-owner-list/:id", async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { name, phone, houseNumber, shopName, area, remark } = req.body;

    if (!name || !phone) {
      return res
        .status(400)
        .json({ success: false, error: "户主姓名和手机号必填" });
    }

    // 获取当前记录并校验小区归属
    const currentRecord = await db
      .collection("shop_owner_list")
      .doc(id)
      .get();
    if (!currentRecord.data || currentRecord.data.length === 0) {
      return res.status(404).json({ success: false, error: "记录不存在" });
    }
    const record = currentRecord.data[0];
    if (record.communityId !== user.communityId) {
      return res.status(403).json({ success: false, error: "无权操作该记录" });
    }

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

    await db
      .collection("shop_owner_list")
      .doc(id)
      .update({
        name,
        phone,
        houseNumber: (houseNumber || "").toString(),
        shopName: (shopName || "").toString(),
        area: parseFloat(area) || 0,
        remark: remark || "",
        ...preservedFields,
        updatedAt: new Date().toISOString(),
      });

    return res.json({ success: true });
  } catch (e) {
    console.error("修改商铺户主信息失败:", e);
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * DELETE /api/shop-owner-list/:id - 删除商铺户主
 * 同时删除对应商铺认证申请（按门牌号+商铺名精确匹配，避免误删同人其他商铺的申请）；
 * 将实名认证信息回写商铺名册（按姓名匹配，便于重新注册时恢复）
 */
router.delete("/shop-owner-list/:id", async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    // 先获取商铺户主信息并校验小区归属
    const ownerRes = await db.collection("shop_owner_list").doc(id).get();
    if (!ownerRes || !ownerRes.data || ownerRes.data.length === 0) {
      return res.status(404).json({ success: false, error: "商铺户主不存在" });
    }

    const owner = ownerRes.data[0];
    if (owner.communityId !== user.communityId) {
      return res.status(403).json({ success: false, error: "无权操作该记录" });
    }

    const { name, phone, communityId } = owner;

    await db.collection("shop_owner_list").doc(id).remove();

    // 删除对应的商铺认证申请记录（手机号/openid + 门牌号 + 商铺名 精确匹配）
    try {
      const certWhere = {
        communityId: communityId,
        houseNumber: owner.houseNumber || "",
        shopName: owner.shopName || "",
      };

      if (phone) {
        const certByPhoneRes = await db
          .collection("shop_certification_applications")
          .where({ ...certWhere, phone: phone })
          .get();

        if (certByPhoneRes && certByPhoneRes.data && certByPhoneRes.data.length > 0) {
          for (const cert of certByPhoneRes.data) {
            await db
              .collection("shop_certification_applications")
              .doc(cert._id)
              .remove();
          }
        }
      }

      if (owner.openid) {
        const certByOpenidRes = await db
          .collection("shop_certification_applications")
          .where({ ...certWhere, openid: owner.openid })
          .get();

        if (certByOpenidRes && certByOpenidRes.data && certByOpenidRes.data.length > 0) {
          for (const cert of certByOpenidRes.data) {
            await db
              .collection("shop_certification_applications")
              .doc(cert._id)
              .remove();
          }
        }
      }
    } catch (certError) {
      console.error("删除商铺认证申请记录失败:", certError);
    }

    // 将实名认证信息保存到商铺名册（按姓名匹配，避免覆盖同名同址的其他户主）
    try {
      if (owner.realNameStatus && owner.realNameStatus !== "unverified") {
        const shopRegRes = await db
          .collection("shop_registry")
          .where({
            communityId: communityId,
            houseNumber: owner.houseNumber || "",
            shopName: owner.shopName || "",
          })
          .get();

        const matchedRecords = (shopRegRes.data || []).filter(
          (reg) => reg.ownerName1 === name || reg.ownerName2 === name,
        );

        for (const reg of matchedRecords) {
          await db
            .collection("shop_registry")
            .doc(reg._id)
            .update({
              realNameStatus: owner.realNameStatus,
              realNameIdCardFront: owner.realNameIdCardFront || "",
              realNameIdCardBack: owner.realNameIdCardBack || "",
              realNameCertType: owner.realNameCertType || "",
              realNameCertImage: owner.realNameCertImage || "",
              realNameSubmitTime: owner.realNameSubmitTime || "",
              realNameRejectReason: owner.realNameRejectReason || "",
              updatedAt: new Date().toISOString(),
            });
        }
      }
    } catch (regError) {
      console.error("保存实名认证数据到shop_registry失败:", regError);
    }

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * GET /api/shop-owner-list/:id/realname - 获取商铺户主实名认证信息
 */
router.get("/shop-owner-list/:id/realname", async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const result = await db.collection("shop_owner_list").doc(id).get();

    if (!result.data || result.data.length === 0) {
      return res.status(404).json({ success: false, error: "未找到商铺户主信息" });
    }

    const owner = result.data[0];

    // 校验小区归属（含身份证图片等隐私数据，禁止跨小区读取）
    if (owner.communityId !== user.communityId) {
      return res.status(403).json({ success: false, error: "无权查看该记录" });
    }

    // 构建返回数据（优先使用 shop_owner_list 中的数据）
    let realNameData = {
      realNameStatus: owner.realNameStatus || "unverified",
      realNameIdCardFront: owner.realNameIdCardFront || "",
      realNameIdCardBack: owner.realNameIdCardBack || "",
      realNameCertType: owner.realNameCertType || "",
      realNameCertImage: owner.realNameCertImage || "",
      realNameSubmitTime: owner.realNameSubmitTime || "",
      realNameRejectReason: owner.realNameRejectReason || "",
    };

    // 如果 shop_owner_list 中没有实名认证信息，尝试从 shop_registry 获取
    if (
      !realNameData.realNameStatus ||
      realNameData.realNameStatus === "unverified"
    ) {
      try {
        const shopRegRes = await db
          .collection("shop_registry")
          .where({
            communityId: owner.communityId,
            houseNumber: owner.houseNumber || "",
            shopName: owner.shopName || "",
          })
          .get();

        // 在内存中查找匹配的记录（含姓名条件）
        const matchedReg = shopRegRes.data?.find(
          (reg) =>
            (reg.ownerName1 === owner.name || reg.ownerName2 === owner.name),
        );

        if (
          matchedReg &&
          matchedReg.realNameStatus &&
          matchedReg.realNameStatus !== "unverified"
        ) {
          // 从 shop_registry 中恢复实名认证信息
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
        console.error("从 shop_registry 查询实名认证信息失败:", regError);
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
 * POST /api/shop-owner-list/:id/realname-review - 审核商铺户主实名认证
 */
router.post("/shop-owner-list/:id/realname-review", async (req, res) => {
  try {
    const user = req.user;
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

    // 先获取商铺户主名单记录并校验小区归属
    const ownerRes = await db.collection("shop_owner_list").doc(id).get();

    if (!ownerRes.data || ownerRes.data.length === 0) {
      return res.status(404).json({ success: false, error: "未找到商铺户主信息" });
    }

    const owner = ownerRes.data[0];
    if (owner.communityId !== user.communityId) {
      return res.status(403).json({ success: false, error: "无权操作该记录" });
    }

    // 更新商铺户主名单
    await db.collection("shop_owner_list").doc(id).update(updateData);

    // 同时更新商铺名册（按小区+门牌号+商铺名查找，且姓名匹配，避免跨户主误更新）
    if (owner.communityId && (owner.houseNumber || owner.shopName)) {
      const shopRegRes = await db
        .collection("shop_registry")
        .where({
          communityId: owner.communityId,
          houseNumber: owner.houseNumber || "",
          shopName: owner.shopName || "",
        })
        .get();

      for (const shopReg of shopRegRes.data || []) {
        if (shopReg.ownerName1 !== owner.name && shopReg.ownerName2 !== owner.name) {
          continue;
        }
        await db
          .collection("shop_registry")
          .doc(shopReg._id)
          .update(updateData);
      }
    }

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

module.exports = router;
