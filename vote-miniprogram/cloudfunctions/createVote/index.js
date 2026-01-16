const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
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
  } = event;

  if (!communityId || !type || !title || !detail) {
    return {
      success: false,
      error: "communityId, type, title and detail are required",
    };
  }

  try {
    const newVote = {
      communityId,
      type, // 'vote' or 'survey'
      title,
      detail,
      attachment: attachment || "",
      attachmentName: attachmentName || "",
      initiator: initiator || "",
      publishTime: publishTime ? new Date(publishTime) : new Date(),
      deadlineTime: deadlineTime
        ? new Date(deadlineTime)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      description: description || "",
      showResult: showResult !== undefined ? showResult : false,
      status: "active", // 'active', 'paused', 'ended'
      optionCounts: {}, // 初始化选项计数
      totalVotes: 0, // 初始化总票数
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 使用 add 方法会自动创建集合
    const res = await db.collection("votes").add({
      data: newVote,
    });

    return {
      success: true,
      id: res._id,
      data: newVote,
    };
  } catch (err) {
    console.error("createVote error:", err);
    return {
      success: false,
      error: err.message || String(err),
      errorDetail: JSON.stringify(err),
    };
  }
};
