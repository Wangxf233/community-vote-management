const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const {
    communityId,
    type,
    title,
    initiator,
    publishTimeStart,
    publishTimeEnd,
    deadlineTimeStart,
    deadlineTimeEnd,
  } = event;

  try {
    // 构建查询条件
    const query = {
      deleted: _.neq(true),
    };

    // 如果提供了 communityId 则过滤
    if (communityId) {
      query.communityId = communityId;
    }

    if (type) {
      query.type = type;
    }

    if (title) {
      query.title = db.RegExp({
        regexp: title,
        options: "i",
      });
    }

    if (initiator) {
      query.initiator = initiator;
    }

    if (publishTimeStart && publishTimeEnd) {
      query.publishTime = _.and(
        _.gte(new Date(publishTimeStart)),
        _.lte(new Date(publishTimeEnd))
      );
    }

    if (deadlineTimeStart && deadlineTimeEnd) {
      query.deadlineTime = _.and(
        _.gte(new Date(deadlineTimeStart)),
        _.lte(new Date(deadlineTimeEnd))
      );
    }

    const res = await db
      .collection("votes")
      .where(query)
      .orderBy("publishTime", "desc")
      .limit(100)
      .get();

    // 附件链接刷新：用 fileID 换取新的临时链接（避免上传时保存的 7 天链接过期）
    const convertKeys = [];
    (res.data || []).forEach((vote) => {
      if (
        vote.attachmentFileID &&
        typeof vote.attachmentFileID === "string" &&
        vote.attachmentFileID.startsWith("cloud://")
      ) {
        convertKeys.push(vote.attachmentFileID);
      } else if (
        typeof vote.attachment === "string" &&
        vote.attachment.startsWith("cloud://")
      ) {
        convertKeys.push(vote.attachment);
      }
    });
    if (convertKeys.length > 0) {
      try {
        const tmpRes = await cloud.getTempFileURL({
          fileList: [...new Set(convertKeys)],
        });
        const urlMap = {};
        (tmpRes.fileList || []).forEach((f) => {
          if (f.fileID && (f.tempFileURL || f.download_url)) {
            urlMap[f.fileID] = f.download_url || f.tempFileURL;
          }
        });
        res.data.forEach((vote) => {
          const key =
            vote.attachmentFileID && urlMap[vote.attachmentFileID]
              ? vote.attachmentFileID
              : vote.attachment;
          if (urlMap[key]) vote.attachment = urlMap[key];
        });
      } catch (e) {
        console.warn("刷新附件链接失败:", e.message);
      }
    }

    return {
      success: true,
      data: res.data,
      total: res.data.length,
    };
  } catch (err) {
    console.error("listVotes error:", err);
    return {
      success: false,
      error: err.message || "Failed to list votes",
    };
  }
};
