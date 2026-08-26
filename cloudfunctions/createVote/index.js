const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 默认固定选项（同意、不同意、弃权）
const FIXED_OPTIONS = [
  { id: "option1", text: "同意" },
  { id: "option2", text: "不同意" },
  { id: "option3", text: "弃权" },
];

exports.main = async (event, context) => {
  const {
    communityId,
    type,
    title,
    detail,
    attachment,
    attachmentName,
    attachmentFileID,
    initiator,
    publishTime,
    deadlineTime,
    description,
    showResult,
    options,
    optionMode,
  } = event;

  if (!communityId || !type || !title || !detail) {
    return {
      success: false,
      error: "communityId, type, title and detail are required",
    };
  }

  // 构建投票选项：自定义模式使用传入的选项文本，否则使用固定选项
  let voteOptions = FIXED_OPTIONS;
  if (optionMode === "custom") {
    // 服务端兜底校验：最多10个选项、单个选项最长50字、去除完全相同的重复项
    const texts = (Array.isArray(options) ? options : [])
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter(Boolean)
      .slice(0, 10);
    const unique = [...new Set(texts)];
    if (unique.length < 2) {
      return {
        success: false,
        error: "自定义投票选项至少需要2个不同的选项",
      };
    }
    voteOptions = unique.map((text, i) => ({
      id: `option${i + 1}`,
      text: text.slice(0, 50),
    }));
  }

  try {
    const newVote = {
      communityId,
      type, // 'vote' or 'survey'
      title,
      detail,
      attachment: attachment || "",
      attachmentName: attachmentName || "",
      attachmentFileID: attachmentFileID || "", // 云存储 fileID，读取时换取新临时链接避免过期
      initiator: initiator || "",
      publishTime: publishTime ? new Date(publishTime) : new Date(),
      deadlineTime: deadlineTime
        ? new Date(deadlineTime)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      description: description || "",
      showResult: showResult !== undefined ? showResult : false,
      status: "active", // 'active', 'paused', 'ended'
      optionMode: optionMode === "custom" ? "custom" : "fixed",
      options: voteOptions, // 投票选项定义（固定或自定义）
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
