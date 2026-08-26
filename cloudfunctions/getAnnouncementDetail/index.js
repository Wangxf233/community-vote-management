const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 计算有效期截止时间
 */
function calculateExpiryTime(announcement) {
  if (announcement.expiryTime) {
    return new Date(announcement.expiryTime);
  }

  if (announcement.expiryDays && announcement.publishTime) {
    const publishTime = new Date(announcement.publishTime);
    const expiryTime = new Date(
      publishTime.getTime() + announcement.expiryDays * 24 * 60 * 60 * 1000
    );
    return expiryTime;
  }

  return null;
}

/**
 * 获取公告详情并标记为已读
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { announcementId } = event;

  try {
    if (!announcementId) {
      return {
        success: false,
        error: "缺少公告ID",
      };
    }

    // 获取公告详情
    const announcementResult = await db
      .collection("announcements")
      .doc(announcementId)
      .get();

    if (!announcementResult.data) {
      return {
        success: false,
        error: "公告不存在",
      };
    }

    const announcement = announcementResult.data;

    // 附件处理：优先用 fileID 换取新的临时链接（避免上传时保存的 7 天链接过期），兼容 cloud:// 旧链接
    let attachments = announcement.attachments || [];
    const convertKeys = attachments
      .map((att) => {
        if (
          att.fileID &&
          typeof att.fileID === "string" &&
          att.fileID.startsWith("cloud://")
        ) {
          return att.fileID;
        }
        if (typeof att.url === "string" && att.url.startsWith("cloud://")) {
          return att.url;
        }
        return "";
      })
      .filter(Boolean);
    if (convertKeys.length > 0) {
      try {
        const tempUrlRes = await cloud.getTempFileURL({
          fileList: [...new Set(convertKeys)],
        });
        const urlMap = {};
        (tempUrlRes.fileList || []).forEach((f) => {
          if (f.fileID && (f.tempFileURL || f.download_url)) {
            urlMap[f.fileID] = f.download_url || f.tempFileURL;
          }
        });
        attachments = attachments.map((att) => {
          const key = att.fileID && urlMap[att.fileID] ? att.fileID : att.url;
          return urlMap[key] ? { ...att, url: urlMap[key] } : att;
        });
      } catch (urlErr) {
        console.warn("转换附件链接失败:", urlErr.message);
      }
    }

    // 按扩展名补充类型，供小程序端区分图片预览/文档预览
    attachments = attachments.map((att) => {
      const extSource = String(att.name || att.url || "")
        .toLowerCase()
        .split("?")[0];
      const ext = extSource.includes(".")
        ? extSource.split(".").pop()
        : "";
      const imageExts = ["png", "jpg", "jpeg", "gif", "bmp", "webp"];
      return {
        ...att,
        type: att.type || (imageExts.includes(ext) ? "image" : "doc"),
      };
    });

    // 检查公告是否已过期
    const now = new Date();
    const expiryTime = calculateExpiryTime(announcement);
    if (expiryTime && now > expiryTime) {
      return {
        success: false,
        error: "该公告已过期",
      };
    }

    // 增加浏览量
    await db
      .collection("announcements")
      .doc(announcementId)
      .update({
        data: {
          viewCount: db.command.inc(1),
        },
      });

    // 标记为已读
    const readResult = await db
      .collection("announcement_reads")
      .where({
        openid: openid,
        announcementId: announcementId,
      })
      .get();

    if (readResult.data.length === 0) {
      await db.collection("announcement_reads").add({
        data: {
          openid: openid,
          announcementId: announcementId,
          readAt: new Date(),
        },
      });
    }

    return {
      success: true,
      data: { ...announcement, attachments },
    };
  } catch (error) {
    console.error("获取公告详情失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
