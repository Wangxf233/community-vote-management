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

    const where = { communityId };
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

    // 获取每个周期的参与统计并动态更新状态
    const cyclesWithStats = await Promise.all(
      result.data.map(async (cycle) => {
        // 动态计算状态
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

        // 如果状态变化，更新数据库
        if (currentStatus !== cycle.status) {
          await db.collection("evaluation_cycles").doc(cycle._id).update({
            status: currentStatus,
            updatedAt: now,
          });
        }

        // 获取该周期已评价的唯一用户数（去重）
        const evaluationsResult = await db
          .collection("evaluations")
          .where({ cycleId: cycle._id })
          .field({ userId: true, openid: true })
          .get();

        // 使用 Set 去重统计参与人数
        const uniqueUsers = new Set(
          evaluationsResult.data.map((e) => e.userId || e.openid)
        );
        const participantCount = uniqueUsers.size;

        // 获取小区户主总数（owner_list 中的所有记录都是户主）
        const totalUsersCount = await db
          .collection("owner_list")
          .where({
            communityId,
          })
          .count();

        return {
          ...cycle,
          status: currentStatus,
          participantCount: participantCount,
          totalUsers: totalUsersCount.total,
        };
      })
    );

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
      startSubmitTime: startSubmitTime || now.toISOString(),
      deadline,
      staffIds,
      dimensions,
      status,
      communityId,
      createdAt: now,
      updatedAt: now,
    };

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

    const updateData = {
      updatedAt: new Date(),
    };

    if (title) updateData.title = title;
    if (startDate) updateData.startDate = startDate;
    if (endDate) updateData.endDate = endDate;
    if (startSubmitTime !== undefined)
      updateData.startSubmitTime = startSubmitTime;
    if (deadline) updateData.deadline = deadline;
    if (staffIds) updateData.staffIds = staffIds;
    if (dimensions) updateData.dimensions = dimensions;

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

    const where = { communityId };
    if (cycleId) {
      where._id = cycleId;
    }

    // 获取评价周期
    const cyclesResult = await db
      .collection("evaluation_cycles")
      .where(where)
      .orderBy("createdAt", "desc")
      .get();

    // 为每个周期计算结果
    const resultsWithData = await Promise.all(
      cyclesResult.data.map(async (cycle) => {
        // 获取该周期的所有评价
        const evaluationsResult = await db
          .collection("evaluations")
          .where({ cycleId: cycle._id })
          .get();

        // 获取参与人数（使用 openid 去重）
        const participantCount = new Set(
          evaluationsResult.data.map((e) => e.openid || e.userId)
        ).size;

        // 获取小区总用户数
        const usersCount = await db
          .collection("owner_list")
          .where({ communityId })
          .count();

        // 按人员统计评分
        const staffResults = {};

        for (const staffId of cycle.staffIds) {
          const staffEvaluations = evaluationsResult.data.filter(
            (e) => e.staffId === staffId
          );

          // 只处理有评价记录的人员
          if (staffEvaluations.length === 0) {
            continue;
          }

          // 获取人员信息
          const staffInfo = await db
            .collection("evaluation_staff")
            .doc(staffId)
            .get();

          if (!staffInfo.data || staffInfo.data.length === 0) {
            continue;
          }

          const staff = staffInfo.data[0];

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
      })
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

      // 获取人员信息
      const staffInfo = await db
        .collection("evaluation_staff")
        .doc(staffId)
        .get();

      if (!staffInfo.data || staffInfo.data.length === 0) {
        return res.status(404).json({ success: false, error: "人员不存在" });
      }

      const staff = staffInfo.data[0];

      // 获取该人员在此周期的所有评价
      const evaluationsResult = await db
        .collection("evaluations")
        .where({ cycleId, staffId })
        .get();

      // 获取周期信息以获取维度
      const cycleInfo = await db
        .collection("evaluation_cycles")
        .doc(cycleId)
        .get();

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

      // 获取评价人信息（从 owner_list 查询）
      const evaluationsWithUser = await Promise.all(
        evaluationsResult.data.map(async (evaluation) => {
          try {
            const userInfo = await db
              .collection("owner_list")
              .where({ openid: evaluation.openid })
              .limit(1)
              .get();
            return {
              ...evaluation,
              userName: userInfo.data[0]?.name || "未知业主",
            };
          } catch (err) {
            return {
              ...evaluation,
              userName: "未知业主",
            };
          }
        })
      );

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
  }
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

    // 获取每个周期的参与统计并动态更新状态
    const cyclesWithStats = await Promise.all(
      result.data.map(async (cycle) => {
        // 动态计算状态
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

        // 如果状态变化，更新数据库
        if (currentStatus !== cycle.status) {
          await db.collection("evaluation_cycles").doc(cycle._id).update({
            status: currentStatus,
            updatedAt: now,
          });
        }

        // 获取该周期已评价的唯一用户数（去重）
        const evaluationsResult = await db
          .collection("evaluations")
          .where({ cycleId: cycle._id })
          .field({ userId: true, openid: true })
          .get();

        // 使用 Set 去重统计参与人数
        const uniqueUsers = new Set(
          evaluationsResult.data.map((e) => e.userId || e.openid)
        );
        const participantCount = uniqueUsers.size;

        // 获取小区户主总数
        const totalUsersCount = await db
          .collection("owner_list")
          .where({
            communityId,
          })
          .count();

        return {
          ...cycle,
          status: currentStatus,
          participantCount: participantCount,
          totalUsers: totalUsersCount.total,
        };
      })
    );

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
      startSubmitTime: startSubmitTime || now.toISOString(),
      deadline,
      dimensions,
      status,
      type: "company",
      communityId,
      createdAt: now,
      updatedAt: now,
    };

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

    const updateData = {
      updatedAt: new Date(),
    };

    if (title) updateData.title = title;
    if (startDate) updateData.startDate = startDate;
    if (endDate) updateData.endDate = endDate;
    if (startSubmitTime !== undefined)
      updateData.startSubmitTime = startSubmitTime;
    if (deadline) updateData.deadline = deadline;
    if (dimensions) updateData.dimensions = dimensions;

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

// 获取物业公司评价结果
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

    // 获取该周期的所有评价（分页）
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    const evaluationsCountResult = await db
      .collection("evaluations")
      .where({ cycleId: cycleId })
      .count();

    const evaluationsResult = await db
      .collection("evaluations")
      .where({ cycleId: cycleId })
      .orderBy("createdAt", "desc")
      .skip(skip)
      .limit(limit)
      .get();

    // 获取所有评价记录（用于统计和计算平均分）
    const allEvaluationsResult = await db
      .collection("evaluations")
      .where({ cycleId: cycleId })
      .get();

    const participantCount = new Set(
      allEvaluationsResult.data.map((e) => e.openid || e.userId)
    ).size;

    // 获取小区总用户数
    const usersCount = await db
      .collection("owner_list")
      .where({ communityId: cycle.communityId })
      .count();

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

    // 获取评价人信息
    const evaluationsWithUser = await Promise.all(
      evaluationsResult.data.map(async (evaluation) => {
        try {
          const userInfo = await db
            .collection("owner_list")
            .where({ openid: evaluation.openid })
            .limit(1)
            .get();
          return {
            ...evaluation,
            userName: userInfo.data[0]?.name || "未知业主",
          };
        } catch (err) {
          return {
            ...evaluation,
            userName: "未知业主",
          };
        }
      })
    );

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
      total: evaluationsCountResult.total,
    });
  } catch (error) {
    console.error("获取物业公司评价结果失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
