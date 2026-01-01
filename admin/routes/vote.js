const express = require("express");
const { tcb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { getTokenFromReq } = require("../utils/helpers");

const router = express.Router();

/**
 * GET /api/votes - 获取投票列表
 */
router.get("/votes", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const {
      communityId,
      type,
      title,
      initiator,
      publishTimeStart,
      publishTimeEnd,
      deadlineTimeStart,
      deadlineTimeEnd,
    } = req.query;

    // 仅允许受控的 type 值，防止传入非法参数导致云函数异常
    const allowedType =
      type && (type === "vote" || type === "survey")
        ? decodeURIComponent(type)
        : undefined;

    const callRes = await tcb.callFunction({
      name: "listVotes",
      data: {
        communityId: communityId
          ? decodeURIComponent(communityId)
          : user.communityId,
        type: allowedType,
        title: title ? decodeURIComponent(title) : undefined,
        initiator: initiator ? decodeURIComponent(initiator) : undefined,
        publishTimeStart: publishTimeStart
          ? decodeURIComponent(publishTimeStart)
          : undefined,
        publishTimeEnd: publishTimeEnd
          ? decodeURIComponent(publishTimeEnd)
          : undefined,
        deadlineTimeStart: deadlineTimeStart
          ? decodeURIComponent(deadlineTimeStart)
          : undefined,
        deadlineTimeEnd: deadlineTimeEnd
          ? decodeURIComponent(deadlineTimeEnd)
          : undefined,
      },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * POST /api/votes - 创建投票
 */
router.post("/votes", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const {
      communityId,
      type,
      title,
      detail,
      attachment,
      attachmentName,
      initiator,
      publishTime,
      deadlineTime,
      description,
      showResult,
    } = req.body;

    const callRes = await tcb.callFunction({
      name: "createVote",
      data: {
        communityId: communityId || user.communityId,
        type,
        title,
        detail,
        attachment,
        attachmentName,
        initiator,
        publishTime,
        deadlineTime,
        description,
        showResult,
      },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * GET /api/votes/:id/statistics - 获取投票统计
 */
router.get("/votes/:id/statistics", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const callRes = await tcb.callFunction({
      name: "getVoteStatistics",
      data: { voteId: id },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PUT /api/votes/:id/pause - 暂停投票
 */
router.put("/votes/:id/pause", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const callRes = await tcb.callFunction({
      name: "updateVote",
      data: { voteId: id, action: "pause" },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PUT /api/votes/:id/resume - 恢复投票
 */
router.put("/votes/:id/resume", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const callRes = await tcb.callFunction({
      name: "updateVote",
      data: { voteId: id, action: "resume" },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PUT /api/votes/:id/deadline - 更新截止时间
 */
router.put("/votes/:id/deadline", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { deadlineTime } = req.body;

    const callRes = await tcb.callFunction({
      name: "updateVote",
      data: { voteId: id, action: "updateDeadline", deadlineTime },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PUT /api/votes/:id/show-result - 切换结果显示
 */
router.put("/votes/:id/show-result", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { showResult } = req.body;

    const callRes = await tcb.callFunction({
      name: "updateVote",
      data: { voteId: id, action: "toggleShowResult", showResult },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * GET /api/votes/:id/records - 获取投票详情记录
 */
router.get("/votes/:id/records", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const token = getTokenFromReq(req);

    const callRes = await tcb.callFunction({
      name: "getVoteRecords",
      data: {
        voteId: id,
        page,
        pageSize,
      },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

module.exports = router;
