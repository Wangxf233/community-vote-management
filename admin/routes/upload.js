const express = require("express");
const multer = require("multer");
const path = require("path");
const { tcb } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 限制10MB
});

/**
 * POST /api/upload - 上传文件到云存储
 */
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "no_file" });
      }

      // 正确处理中文文件名
      const originalname = Buffer.from(
        req.file.originalname,
        "latin1"
      ).toString("utf8");

      // 生成唯一文件名，保留原始文件名（支持中文）
      const ext = path.extname(originalname);
      const basename = path.basename(originalname, ext);
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2);
      const filename = `vote-attachments/${timestamp}-${random}-${basename}${ext}`;

      // 上传到云存储
      const result = await tcb.uploadFile({
        cloudPath: filename,
        fileContent: req.file.buffer,
      });

      if (!result || !result.fileID) {
        return res
          .status(500)
          .json({ success: false, error: "upload_to_cloud_failed" });
      }

      // 获取临时下载链接（有效期7天）
      let fileUrl = result.fileID;
      try {
        const tempUrlRes = await tcb.getTempFileURL({
          fileList: [result.fileID],
          maxAge: 604800, // 7天
        });

        if (
          tempUrlRes &&
          tempUrlRes.fileList &&
          tempUrlRes.fileList[0] &&
          tempUrlRes.fileList[0].tempFileURL
        ) {
          fileUrl = tempUrlRes.fileList[0].tempFileURL;
        }
      } catch (urlErr) {
        console.warn("Failed to get temp URL, using fileID:", urlErr.message);
        // 使用 fileID 作为 fallback
      }

      return res.json({
        success: true,
        url: fileUrl,
        fileID: result.fileID,
        name: originalname, // 返回正确的中文文件名
      });
    } catch (e) {
      console.error("Upload error:", e);
      return res.status(500).json({
        success: false,
        error: e.message || "Upload failed",
      });
    }
  }
);

module.exports = router;
