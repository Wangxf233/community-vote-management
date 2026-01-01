const express = require("express");
const { tcb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { getTokenFromReq } = require("../utils/helpers");

const router = express.Router();

/**
 * GET /api/export/bindings - 导出绑定数据为CSV
 */
router.get("/export/bindings", authMiddleware, async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    const filters = req.query || {};

    // 调用云函数导出CSV
    const callRes = await tcb.callFunction({
      name: "adminExportBindingsCSV",
      data: { adminToken: token, filters },
    });

    const result = callRes.result || callRes;
    if (!result || !result.success) {
      return res.status(500).json(result);
    }

    const csv = result.csv || "";
    const filename = `bindings_export_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "_")}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || e });
  }
});

module.exports = router;
