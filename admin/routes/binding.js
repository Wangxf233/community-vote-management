const express = require("express");
const { tcb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { getTokenFromReq } = require("../utils/helpers");

const router = express.Router();

// 所有路由都需要认证
router.use(authMiddleware);

/**
 * GET /api/bindings - 获取绑定列表
 */
router.get("/bindings", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const page = parseInt(req.query.page || "1", 10);
    const pageSize = parseInt(req.query.pageSize || "20", 10);
    const status = req.query.status;
    const communityName = req.query.communityName;

    const callRes = await tcb.callFunction({
      name: "adminListBindings",
      data: { adminToken: token, page, pageSize, status, communityName },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * GET /api/bindings/:id - 获取单条绑定
 */
router.get("/bindings/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const bindingId = req.params.id;

    const callRes = await tcb.callFunction({
      name: "adminGetBinding",
      data: { adminToken: token, bindingId },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

/**
 * PATCH /api/bindings/:id - 审核绑定（approve/reject）
 */
router.patch("/bindings/:id", async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const bindingId = req.params.id;
    const { action, reason } = req.body || {};

    if (!action || (action !== "approve" && action !== "reject")) {
      return res.status(400).json({ success: false, error: "invalid action" });
    }

    const callRes = await tcb.callFunction({
      name: "adminUpdateBinding",
      data: { adminToken: token, bindingId, action, reason },
    });

    return res.json(callRes.result || callRes);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

module.exports = router;
