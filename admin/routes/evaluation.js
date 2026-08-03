const express = require("express");
const router = express.Router();
const { db, tcb } = require("../config/db");
const { verifyToken } = require("../middleware/auth");
const _ = db.command;

// ==================== 服务人员管理 ====================

// 获取服务人员列表
router.get("/staff", verifyToken, async (req, res) => {
  try {
    const { communityId, status, page = 1, pageSize = 10 } = req.query;

    if (!communityId) {
      return res.status(400).json({ success: false, error: "缺少小区ID" });
    }

    const where = { communityId };
    if (status) {
      where.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    const countResult = await db
      .collection("evaluation_staff")
      .where(where)
      .count();
    const result = await db
      .collection("evaluation_staff")
      .where(where)
      .orderBy("createdAt", "desc")
      .skip(skip)
      .limit(limit)
      .get();

    res.json({
      success: true,
      data: result.data,
      total: countResult.total,
    });
  } catch (error) {
    console.error("获取服务人员列表失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加服务人员
router.post("/staff", verifyToken, async (req, res) => {
  try {
    const { name, position, workScope, photo, communityId } = req.body;

    if (!name || !position || !workScope || !communityId) {
      return res.status(400).json({ success: false, error: "缺少必填字段" });
    }

    const staffData = {
      name,
      position,
      workScope,
      photo: photo || "",
      status: "active",
      communityId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("evaluation_staff").add(staffData);

    res.json({
      success: true,
      data: { _id: result.id, ...staffData },
    });
  } catch (error) {
    console.error("添加服务人员失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新服务人员
router.put("/staff/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, position, workScope, photo, status } = req.body;

    const updateData = {
      updatedAt: new Date(),
    };

    if (name) updateData.name = name;
    if (position) updateData.position = position;
    if (workScope) updateData.workScope = workScope;
    if (photo !== undefined) updateData.photo = photo;
    if (status) updateData.status = status;

    await db.collection("evaluation_staff").doc(id).update(updateData);

    res.json({ success: true });
  } catch (error) {
    console.error("更新服务人员失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除服务人员
router.delete("/staff/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查该人员是否在任何评价周期中
    const cyclesResult = await db
      .collection("evaluation_cycles")
      .where({
        staffIds: _.in([id]),
      })
      .get();

    if (cyclesResult.data.length > 0) {
      return res.status(400).json({
        success: false,
        error: "该服务人员已被添加到评价周期中，无法删除",
      });
    }

    // 删除服务人员
    await db.collection("evaluation_staff").doc(id).remove();

    res.json({ success: true });
  } catch (error) {
    console.error("删除服务人员失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 评价周期管理 ====================

// 获取评价周期列表
router.get("/cycles", verifyToken, async (req, res) => {
  try {
    const { communityId, page = 1, pageSize = 10 } = req.query;

    if (!communityId) {
      return res.status(400).json({ success: false, error: "缺少小区ID" });
    }

    // 只查询服务人员评价周期（type为staff或不存在type字段的旧数据）
    const where = {
      communityId,
      _: _.or({ type: _.eq("staff") }, { type: _.exists(false) }),
    };
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    const countResult = await db
      .collection("evaluation_cycles")
      .where(where)
      .count();
    const result = await db
      .collection("evaluation_cycles")
      .where(where)
      .orderBy("createdAt", "desc")
      .skip(skip)
      .limit(limit)
      .get();

    const now = new Date();

    // 批量查询：所有周期的评价记录（一次代替 N 次）+ 小区总户数（只查一次）
    const cycleIds = result.data.map((c) => c._id);
    const [allEvaluations, totalUsersCount] = await Promise.all([
      cycleIds.length > 0
        ? db
            .collection("evaluations")
            .where({ cycleId: _.in(cycleIds) })
            .field({ userId: true, openid: true, cycleId: true })
            .get()
        : Promise.resolve({ data: [] }),
      db.collection("owner_list").where({ communityId }).count(),
    ]);

    // 按 cycleId 分组评价记录
    const evalsByCycleId = {};
    for (const e of allEvaluations.data) {
      if (!evalsByCycleId[e.cycleId]) evalsByCycleId[e.cycleId] = [];
      evalsByCycleId[e.cycleId].push(e);
    }

    // 计算状态变化，批量写回（只写变化的）
    const statusUpdates = [];
    const cyclesWithStats = result.data.map((cycle) => {
      const startTime = new Date(cycle.startSubmitTime || cycle.createdAt);
      const deadlineTime = new Date(cycle.deadline);

      let currentStatus = cycle.status;
      if (now >= startTime && now < deadlineTime) {
        currentStatus = "ongoing";
      } else if (now >= deadlineTime) {
        currentStatus = "closed";
      } else {
        currentStatus = "draft";
      }

      if (currentStatus !== cycle.status) {
        statusUpdates.push(
          db
            .collection("evaluation_cycles")
            .doc(cycle._id)
            .update({ status: currentStatus, updatedAt: now }),
        );
      }

      const cycleEvals = evalsByCycleId[cycle._id] || [];
      const participantCount = new Set(
        cycleEvals.map((e) => e.userId || e.openid),
      ).size;

      return {
        ...cycle,
        status: currentStatus,
        participantCount,
        totalUsers: totalUsersCount.total,
      };
    });

    // 异步写回状态变更，不阻塞响应
    if (statusUpdates.length > 0) Promise.all(statusUpdates).catch(() => {});

    res.json({
      success: true,
      data: cyclesWithStats,
      total: countResult.total,
    });
  } catch (error) {
    console.error("获取评价周期列表失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加评价周期
router.post("/cycles", verifyToken, async (req, res) => {
  try {
    const {
      title,
      startDate,
      endDate,
      startSubmitTime,
      deadline,
      staffIds,
      dimensions,
      communityId,
      recurring,
    } = req.body;

    if (
      !title ||
      !startDate ||
      !endDate ||
      !deadline ||
      !staffIds ||
      !dimensions ||
      !communityId
    ) {
      return res.status(400).json({ success: false, error: "缺少必填字段" });
    }

    const now = new Date();
    const startTime = startSubmitTime ? new Date(startSubmitTime) : now;
    const deadlineTime = new Date(deadline);

    // 根据时间自动判断状态
    let status = "draft";
    if (now >= startTime && now < deadlineTime) {
      status = "ongoing";
    } else if (now >= deadlineTime) {
      status = "closed";
    }

    const cycleData = {
      title,
      startDate,
      endDate,
      startSubmitTime: startSubmitTime
        ? new Date(startSubmitTime).toISOString()
        : now.toISOString(),
      deadline: new Date(deadline).toISOString(),
      staffIds,
      dimensions,
      status,
      type: "staff",
      communityId,
      createdAt: now,
      updatedAt: now,
    };

    if (recurring && recurring.enabled) {
      cycleData.recurring = {
        enabled: true,
        frequency: recurring.frequency || "quarterly",
        firstDate: recurring.firstDate,
        durationDays: recurring.durationDays || 90,
        totalEndDate: recurring.totalEndDate || null,
        lastGeneratedDate: null,
      };
    }

    const result = await db.collection("evaluation_cycles").add(cycleData);

    res.json({
      success: true,
      data: { _id: result.id, ...cycleData },
    });
  } catch (error) {
    console.error("添加评价周期失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新评价周期
router.put("/cycles/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      startDate,
      endDate,
      startSubmitTime,
      deadline,
      staffIds,
      dimensions,
    } = req.body;

    const now = new Date();
    const updateData = {
      updatedAt: now,
    };

    if (title) updateData.title = title;
    if (startDate) updateData.startDate = startDate;
    if (endDate) updateData.endDate = endDate;
    if (startSubmitTime !== undefined)
      updateData.startSubmitTime = startSubmitTime;
    if (deadline) {
      // 确保 deadline 是标准的 ISO 格式
      updateData.deadline = new Date(deadline).toISOString();
    }
    if (staffIds) updateData.staffIds = staffIds;
    if (dimensions) updateData.dimensions = dimensions;
    if (req.body.recurring !== undefined) {
      if (req.body.recurring && req.body.recurring.enabled) {
        updateData.recurring = {
          enabled: true,
          frequency: req.body.recurring.frequency || "quarterly",
          firstDate: req.body.recurring.firstDate,
          durationDays: req.body.recurring.durationDays || 90,
          totalEndDate: req.body.recurring.totalEndDate || null,
          lastGeneratedDate: req.body.recurring.lastGeneratedDate || null,
        };
      } else {
        updateData.recurring = _.remove();
      }
    }

    // 重新计算状态
    if (deadline || startSubmitTime !== undefined) {
      // 获取当前周期数据
      const cycleResult = await db
        .collection("evaluation_cycles")
        .doc(id)
        .get();
      const cycle = cycleResult.data[0];

      const startTime = startSubmitTime
        ? new Date(startSubmitTime)
        : new Date(cycle.startSubmitTime || cycle.createdAt);
      const deadlineTime = deadline
        ? new Date(deadline)
        : new Date(cycle.deadline);

      let status = "draft";
      if (now >= startTime && now < deadlineTime) {
        status = "ongoing";
      } else if (now >= deadlineTime) {
        status = "closed";
      }

      updateData.status = status;
    }

    await db.collection("evaluation_cycles").doc(id).update(updateData);

    res.json({ success: true });
  } catch (error) {
    console.error("更新评价周期失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 发布评价周期
router.put("/cycles/:id/publish", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection("evaluation_cycles").doc(id).update({
      status: "ongoing",
      publishedAt: new Date(),
      updatedAt: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("发布评价周期失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除评价周期
router.delete("/cycles/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 删除该周期相关的所有评价
    await db.collection("evaluations").where({ cycleId: id }).remove();

    // 删除周期
    await db.collection("evaluation_cycles").doc(id).remove();

    res.json({ success: true });
  } catch (error) {
    console.error("删除评价周期失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 评价结果管理 ====================

// 获取评价结果列表
router.get("/results", verifyToken, async (req, res) => {
  try {
    const { communityId, cycleId } = req.query;

    if (!communityId) {
      return res.status(400).json({ success: false, error: "缺少小区ID" });
    }

    // 只查询服务人员评价周期（type为staff或不存在type字段的旧数据）
    const where = {
      communityId,
      _: _.or({ type: _.eq("staff") }, { type: _.exists(false) }),
    };
    if (cycleId) {
      where._id = cycleId;
    }

    // 获取评价周期（加 limit 防止无界扫描）
    const cyclesResult = await db
      .collection("evaluation_cycles")
      .where(where)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    // 批量查询所有周期的评价记录 + 小区总户数（替代 N×2 次独立查询）
    const allCycleIds = cyclesResult.data.map((c) => c._id);
    const [allEvals, communityUsersCount] = await Promise.all([
      allCycleIds.length > 0
        ? db
            .collection("evaluations")
            .where({ cycleId: _.in(allCycleIds) })
            .get()
        : Promise.resolve({ data: [] }),
      db.collection("owner_list").where({ communityId }).count(),
    ]);
    const evalsByCycle = {};
    for (const e of allEvals.data) {
      if (!evalsByCycle[e.cycleId]) evalsByCycle[e.cycleId] = [];
      evalsByCycle[e.cycleId].push(e);
    }

    // 为每个周期计算结果
    const resultsWithData = await Promise.all(
      cyclesResult.data.map(async (cycle) => {
        const evaluationsResult = { data: evalsByCycle[cycle._id] || [] };

        // 获取参与人数（使用 openid 去重）
        const participantCount = new Set(
          evaluationsResult.data.map((e) => e.openid || e.userId),
        ).size;

        const usersCount = { total: communityUsersCount.total };

        // 按人员统计评分
        const staffResults = {};

        // 批量获取本周期有评价记录的服务人员信息（一次查询替代 N 次 doc().get()）
        const staffIdsWithEvals = (cycle.staffIds || []).filter((staffId) =>
          evaluationsResult.data.some((e) => e.staffId === staffId),
        );
        const staffInfoMap = {};
        if (staffIdsWithEvals.length > 0) {
          const staffInfoRes = await db
            .collection("evaluation_staff")
            .where({ _id: _.in(staffIdsWithEvals) })
            .get();
          for (const s of staffInfoRes.data || []) {
            staffInfoMap[s._id] = s;
          }
        }

        for (const staffId of cycle.staffIds) {
          const staffEvaluations = evaluationsResult.data.filter(
            (e) => e.staffId === staffId,
          );

          // 只处理有评价记录的人员
          if (staffEvaluations.length === 0) {
            continue;
          }

          const staff = staffInfoMap[staffId];
          if (!staff) {
            continue;
          }

          // 计算各维度平均分
          const dimensionScores = {};
          let totalScore = 0;

          cycle.dimensions.forEach((dim) => {
            const scores = staffEvaluations
              .map((e) => e.scores[dim.name])
              .filter((s) => s !== undefined);

            if (scores.length > 0) {
              const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
              dimensionScores[dim.name] = avg;
              totalScore += avg;
            }
          });

          const averageScore = totalScore / cycle.dimensions.length;

          staffResults[staffId] = {
            staffId,
            name: staff.name || "未知",
            position: staff.position || "未知职位",
            photo: staff.photo || "",
            dimensionScores,
            averageScore,
            evaluationCount: staffEvaluations.length,
          };
        }

        return {
          ...cycle,
          participantCount,
          totalUsers: usersCount.total,
          staffResults: Object.values(staffResults),
        };
      }),
    );

    res.json({
      success: true,
      data: resultsWithData,
    });
  } catch (error) {
    console.error("获取评价结果失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取某个人员的详细评价
router.get(
  "/results/:cycleId/staff/:staffId",
  verifyToken,
  async (req, res) => {
    try {
      const { cycleId, staffId } = req.params;

      // 三个独立查询并行执行
      const [staffInfo, evaluationsResult, cycleInfo] = await Promise.all([
        db.collection("evaluation_staff").doc(staffId).get(),
        db.collection("evaluations").where({ cycleId, staffId }).get(),
        db.collection("evaluation_cycles").doc(cycleId).get(),
      ]);

      if (!staffInfo.data || staffInfo.data.length === 0) {
        return res.status(404).json({ success: false, error: "人员不存在" });
      }

      const staff = staffInfo.data[0];

      if (!cycleInfo.data || cycleInfo.data.length === 0) {
        return res.status(404).json({ success: false, error: "周期不存在" });
      }

      const cycle = cycleInfo.data[0];

      // 计算各维度平均分
      const dimensionScores = {};
      let totalScore = 0;

      cycle.dimensions.forEach((dim) => {
        const scores = evaluationsResult.data
          .map((e) => e.scores[dim.name])
          .filter((s) => s !== undefined);

        if (scores.length > 0) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          dimensionScores[dim.name] = avg;
          totalScore += avg;
        }
      });

      const averageScore = totalScore / (cycle.dimensions.length || 1);

      // 批量查询评价人信息（替代每条评价独立查一次 owner_list）
      const openids = [
        ...new Set(evaluationsResult.data.map((e) => e.openid).filter(Boolean)),
      ];
      const userMap = {};
      if (openids.length > 0) {
        const usersRes = await db
          .collection("owner_list")
          .where({ openid: _.in(openids) })
          .get();
        for (const u of usersRes.data || []) {
          userMap[u.openid] = u.name || "未知业主";
        }
      }
      const evaluationsWithUser = evaluationsResult.data.map((e) => ({
        ...e,
        userName: userMap[e.openid] || "未知业主",
      }));

      res.json({
        success: true,
        data: {
          ...staff,
          dimensionScores,
          averageScore,
          evaluationCount: evaluationsResult.data.length,
          evaluations: evaluationsWithUser,
        },
      });
    } catch (error) {
      console.error("获取评价详情失败:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// ==================== 物业公司评价管理 ====================

// 获取物业公司评价周期列表
router.get("/company-cycles", verifyToken, async (req, res) => {
  try {
    const { communityId, page = 1, pageSize = 10 } = req.query;

    if (!communityId) {
      return res.status(400).json({ success: false, error: "缺少小区ID" });
    }

    const where = { communityId, type: "company" };
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    const countResult = await db
      .collection("evaluation_cycles")
      .where(where)
      .count();
    const result = await db
      .collection("evaluation_cycles")
      .where(where)
      .orderBy("createdAt", "desc")
      .skip(skip)
      .limit(limit)
      .get();

    const now = new Date();

    // 批量查询：所有周期的评价记录（一次代替 N 次）+ 小区总户数（只查一次）
    const cycleIds = result.data.map((c) => c._id);
    const [allEvaluations, totalUsersCount] = await Promise.all([
      cycleIds.length > 0
        ? db
            .collection("evaluations")
            .where({ cycleId: _.in(cycleIds) })
            .field({ userId: true, openid: true, cycleId: true })
            .get()
        : Promise.resolve({ data: [] }),
      db.collection("owner_list").where({ communityId }).count(),
    ]);

    const evalsByCycleId = {};
    for (const e of allEvaluations.data) {
      if (!evalsByCycleId[e.cycleId]) evalsByCycleId[e.cycleId] = [];
      evalsByCycleId[e.cycleId].push(e);
    }

    const statusUpdates = [];
    const cyclesWithStats = result.data.map((cycle) => {
      const startTime = new Date(cycle.startSubmitTime || cycle.createdAt);
      const deadlineTime = new Date(cycle.deadline);

      let currentStatus = cycle.status;
      if (now >= startTime && now < deadlineTime) {
        currentStatus = "ongoing";
      } else if (now >= deadlineTime) {
        currentStatus = "closed";
      } else {
        currentStatus = "draft";
      }

      if (currentStatus !== cycle.status) {
        statusUpdates.push(
          db
            .collection("evaluation_cycles")
            .doc(cycle._id)
            .update({ status: currentStatus, updatedAt: now }),
        );
      }

      const cycleEvals = evalsByCycleId[cycle._id] || [];
      const participantCount = new Set(
        cycleEvals.map((e) => e.userId || e.openid),
      ).size;

      return {
        ...cycle,
        status: currentStatus,
        participantCount,
        totalUsers: totalUsersCount.total,
      };
    });

    if (statusUpdates.length > 0) Promise.all(statusUpdates).catch(() => {});

    res.json({
      success: true,
      data: cyclesWithStats,
      total: countResult.total,
    });
  } catch (error) {
    console.error("获取物业公司评价周期列表失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加物业公司评价周期
router.post("/company-cycles", verifyToken, async (req, res) => {
  try {
    const {
      title,
      startDate,
      endDate,
      startSubmitTime,
      deadline,
      dimensions,
      communityId,
      recurring,
    } = req.body;

    if (
      !title ||
      !startDate ||
      !endDate ||
      !deadline ||
      !dimensions ||
      !communityId
    ) {
      return res.status(400).json({ success: false, error: "缺少必填字段" });
    }

    const now = new Date();
    const startTime = startSubmitTime ? new Date(startSubmitTime) : now;
    const deadlineTime = new Date(deadline);

    // 根据时间自动判断状态
    let status = "draft";
    if (now >= startTime && now < deadlineTime) {
      status = "ongoing";
    } else if (now >= deadlineTime) {
      status = "closed";
    }

    const cycleData = {
      title,
      startDate,
      endDate,
      startSubmitTime: startSubmitTime
        ? new Date(startSubmitTime).toISOString()
        : now.toISOString(),
      deadline: new Date(deadline).toISOString(),
      dimensions,
      status,
      type: "company",
      communityId,
      createdAt: now,
      updatedAt: now,
    };

    if (recurring && recurring.enabled) {
      cycleData.recurring = {
        enabled: true,
        frequency: recurring.frequency || "quarterly",
        firstDate: recurring.firstDate,
        durationDays: recurring.durationDays || 90,
        totalEndDate: recurring.totalEndDate || null,
        lastGeneratedDate: null,
      };
    }

    const result = await db.collection("evaluation_cycles").add(cycleData);

    res.json({
      success: true,
      data: { _id: result.id, ...cycleData },
    });
  } catch (error) {
    console.error("添加物业公司评价周期失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新物业公司评价周期
router.put("/company-cycles/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, startDate, endDate, startSubmitTime, deadline, dimensions } =
      req.body;

    const now = new Date();
    const updateData = {
      updatedAt: now,
    };

    if (title) updateData.title = title;
    if (startDate) updateData.startDate = startDate;
    if (endDate) updateData.endDate = endDate;
    if (startSubmitTime !== undefined)
      updateData.startSubmitTime = new Date(startSubmitTime).toISOString();
    if (deadline) {
      // 确保 deadline 是标准的 ISO 格式
      updateData.deadline = new Date(deadline).toISOString();
    }
    if (dimensions) updateData.dimensions = dimensions;
    if (req.body.recurring !== undefined) {
      if (req.body.recurring && req.body.recurring.enabled) {
        updateData.recurring = {
          enabled: true,
          frequency: req.body.recurring.frequency || "quarterly",
          firstDate: req.body.recurring.firstDate,
          durationDays: req.body.recurring.durationDays || 90,
          totalEndDate: req.body.recurring.totalEndDate || null,
          lastGeneratedDate: req.body.recurring.lastGeneratedDate || null,
        };
      } else {
        updateData.recurring = _.remove();
      }
    }

    // 重新计算状态
    if (deadline || startSubmitTime !== undefined) {
      // 获取当前周期数据
      const cycleResult = await db
        .collection("evaluation_cycles")
        .doc(id)
        .get();
      const cycle = cycleResult.data[0];

      const startTime = startSubmitTime
        ? new Date(startSubmitTime)
        : new Date(cycle.startSubmitTime || cycle.createdAt);
      const deadlineTime = deadline
        ? new Date(deadline)
        : new Date(cycle.deadline);

      let status = "draft";
      if (now >= startTime && now < deadlineTime) {
        status = "ongoing";
      } else if (now >= deadlineTime) {
        status = "closed";
      }

      updateData.status = status;
    }

    await db.collection("evaluation_cycles").doc(id).update(updateData);

    res.json({ success: true });
  } catch (error) {
    console.error("更新物业公司评价周期失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除物业公司评价周期
router.delete("/company-cycles/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 删除该周期相关的所有评价
    await db.collection("evaluations").where({ cycleId: id }).remove();

    // 删除周期
    await db.collection("evaluation_cycles").doc(id).remove();

    res.json({ success: true });
  } catch (error) {
    console.error("删除物业公司评价周期失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取物业公司评价结果列表（所有周期）
router.get("/company-results", verifyToken, async (req, res) => {
  try {
    const { communityId, cycleId } = req.query;

    if (!communityId) {
      return res.status(400).json({ success: false, error: "缺少小区ID" });
    }

    const where = { communityId, type: "company" };
    if (cycleId) {
      where._id = cycleId;
    }

    // 获取评价周期（加 limit 防止无界扫描）
    const cyclesResult = await db
      .collection("evaluation_cycles")
      .where(where)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    // 批量查询所有周期的评价记录 + 小区总户数（替代 N×2 次独立查询）
    const allCycleIds = cyclesResult.data.map((c) => c._id);
    const [allEvals, communityUsersCount] = await Promise.all([
      allCycleIds.length > 0
        ? db
            .collection("evaluations")
            .where({ cycleId: _.in(allCycleIds) })
            .get()
        : Promise.resolve({ data: [] }),
      db.collection("owner_list").where({ communityId }).count(),
    ]);
    const evalsByCycle = {};
    for (const e of allEvals.data) {
      if (!evalsByCycle[e.cycleId]) evalsByCycle[e.cycleId] = [];
      evalsByCycle[e.cycleId].push(e);
    }

    // 为每个周期计算结果
    const resultsWithData = await Promise.all(
      cyclesResult.data.map(async (cycle) => {
        const evaluationsResult = { data: evalsByCycle[cycle._id] || [] };

        // 获取参与人数（使用 openid 去重）
        const participantCount = new Set(
          evaluationsResult.data.map((e) => e.openid || e.userId),
        ).size;

        const usersCount = { total: communityUsersCount.total };

        // 计算各维度平均分
        const dimensionScores = {};
        let totalScore = 0;

        (cycle.dimensions || []).forEach((dim) => {
          const scores = evaluationsResult.data
            .map((e) => e.scores && e.scores[dim.name])
            .filter((s) => s !== undefined && s !== null);

          if (scores.length > 0) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            dimensionScores[dim.name] = avg;
            totalScore += avg;
          }
        });

        const averageScore =
          (cycle.dimensions || []).length > 0
            ? totalScore / cycle.dimensions.length
            : 0;

        return {
          ...cycle,
          participantCount,
          totalUsers: usersCount.total,
          dimensionScores,
          averageScore,
          evaluationCount: evaluationsResult.data.length,
        };
      }),
    );

    res.json({
      success: true,
      data: resultsWithData,
    });
  } catch (error) {
    console.error("获取物业公司评价结果列表失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取物业公司评价结果（单个周期详情）
router.get("/company-results/:cycleId", verifyToken, async (req, res) => {
  try {
    const { cycleId } = req.params;
    const { page = 1, pageSize = 10 } = req.query;

    if (!cycleId) {
      return res.status(400).json({ success: false, error: "缺少周期ID" });
    }

    // 获取周期信息
    const cycleInfo = await db
      .collection("evaluation_cycles")
      .doc(cycleId)
      .get();

    if (!cycleInfo.data || cycleInfo.data.length === 0) {
      return res.status(404).json({ success: false, error: "周期不存在" });
    }

    const cycle = cycleInfo.data[0];

    if (!cycle.communityId) {
      return res.status(400).json({ success: false, error: "周期缺少小区ID" });
    }

    // 并行获取：分页数据 + 全量数据（用于统计）+ 小区总户数
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);
    const [evaluationsResult, allEvaluationsResult, usersCount] =
      await Promise.all([
        db
          .collection("evaluations")
          .where({ cycleId: cycleId })
          .orderBy("createdAt", "desc")
          .skip(skip)
          .limit(limit)
          .get(),
        db.collection("evaluations").where({ cycleId: cycleId }).get(),
        db
          .collection("owner_list")
          .where({ communityId: cycle.communityId })
          .count(),
      ]);

    // allEvaluationsResult 已包含全量，直接取 length 作为总数
    const evaluationsTotal = allEvaluationsResult.data.length;

    const participantCount = new Set(
      allEvaluationsResult.data.map((e) => e.openid || e.userId),
    ).size;

    // 计算各维度平均分
    const dimensionScores = {};
    let totalScore = 0;

    (cycle.dimensions || []).forEach((dim) => {
      const scores = allEvaluationsResult.data
        .map((e) => e.scores && e.scores[dim.name])
        .filter((s) => s !== undefined && s !== null);

      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        dimensionScores[dim.name] = avg;
        totalScore += avg;
      }
    });

    const averageScore =
      (cycle.dimensions || []).length > 0
        ? totalScore / cycle.dimensions.length
        : 0;

    // 批量查询评价人信息（替代每条评价独立查一次 owner_list）
    const pageOpenids = [
      ...new Set(evaluationsResult.data.map((e) => e.openid).filter(Boolean)),
    ];
    const pageUserMap = {};
    if (pageOpenids.length > 0) {
      const pageUsersRes = await db
        .collection("owner_list")
        .where({ openid: _.in(pageOpenids) })
        .get();
      for (const u of pageUsersRes.data || []) {
        pageUserMap[u.openid] = u.name || "未知业主";
      }
    }
    const evaluationsWithUser = evaluationsResult.data.map((e) => ({
      ...e,
      userName: pageUserMap[e.openid] || "未知业主",
    }));

    res.json({
      success: true,
      data: {
        ...cycle,
        participantCount,
        totalUsers: usersCount.total,
        dimensionScores,
        averageScore,
        evaluations: evaluationsWithUser,
      },
      total: evaluationsTotal,
    });
  } catch (error) {
    console.error("获取物业公司评价结果失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 定期自动发布 ====================

// 计算下一期开始日期
function addInterval(date, frequency) {
  const d = new Date(date);
  switch (frequency) {
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "semi_annual":
      d.setMonth(d.getMonth() + 6);
      break;
    case "annual":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 3);
  }
  return d;
}

// 检查并自动生成下一期评价（供定时任务调用）
router.get("/check-recurring", async (req, res) => {
  try {
    const now = new Date();
    const closedCycles = await db
      .collection("evaluation_cycles")
      .where({
        "recurring.enabled": true,
        status: "closed",
      })
      .limit(100)
      .get();

    let generated = 0;
    const cycles = closedCycles.data || [];

    for (const cycle of cycles) {
      const rec = cycle.recurring;
      if (!rec || !rec.enabled) continue;

      // 计算下一期开始日期
      const baseDate = rec.lastGeneratedDate
        ? new Date(rec.lastGeneratedDate)
        : new Date(cycle.startDate);
      const nextStart = addInterval(baseDate, rec.frequency);

      // 超过总结束日期，不再生成
      if (rec.totalEndDate && nextStart > new Date(rec.totalEndDate)) continue;

      // 还没到下一期发布时间
      if (nextStart > now) continue;

      // 计算下一期结束日期
      const nextEnd = new Date(nextStart);
      nextEnd.setDate(nextEnd.getDate() + (rec.durationDays || 90) - 1);

      const fmtDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      const newCycle = {
        title: cycle.title,
        startDate: fmtDate(nextStart),
        endDate: fmtDate(nextEnd),
        startSubmitTime: nextStart.toISOString(),
        deadline: nextEnd.toISOString(),
        staffIds: cycle.staffIds || [],
        dimensions: cycle.dimensions || [],
        status: nextStart <= now && now < nextEnd ? "ongoing" : "draft",
        type: cycle.type || "staff",
        communityId: cycle.communityId,
        recurring: {
          enabled: true,
          frequency: rec.frequency,
          firstDate: rec.firstDate,
          durationDays: rec.durationDays,
          totalEndDate: rec.totalEndDate || null,
          lastGeneratedDate: null,
        },
        createdAt: now,
        updatedAt: now,
      };

      await db.collection("evaluation_cycles").add(newCycle);

      // 更新原始周期的 lastGeneratedDate
      await db
        .collection("evaluation_cycles")
        .doc(cycle._id)
        .update({
          "recurring.lastGeneratedDate": fmtDate(nextStart),
          updatedAt: now,
        });

      generated++;
    }

    res.json({ success: true, generated, checkedAt: now.toISOString() });
  } catch (error) {
    console.error("检查自动发布失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
