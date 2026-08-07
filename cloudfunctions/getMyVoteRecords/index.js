const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { communityId } = event;

  try {
    // 构建查询条件
    const whereCondition = {
      openid: openid,
      deleted: _.neq(true),
    };

    // 如果提供了 communityId，则添加小区过滤
    if (communityId) {
      whereCondition.communityId = communityId;
    }

    // 查 vote_records 时强制要求 communityId（关键：防止跨小区数据泄露）
    if (!whereCondition.communityId) {
      return { success: false, error: "无法确定所属小区" };
    }

    // 查询该用户的所有投票记录
    const recordsRes = await db
      .collection("vote_records")
      .where(whereCondition)
      .orderBy("createdAt", "desc")
      .get();

    const records = recordsRes.data || [];

    // 获取所有相关投票的详细信息
    const voteIds = [...new Set(records.map((r) => r.voteId))];

    const votesMap = {};
    if (voteIds.length > 0) {
      // 批量查询投票信息（排除已删除 + 本小区）
      const whereVotes = {
        _id: _.in(voteIds),
        deleted: _.neq(true),
      };
      if (communityId) whereVotes.communityId = communityId;
      const votesRes = await db
        .collection("votes")
        .where(whereVotes)
        .get();

      votesRes.data.forEach((vote) => {
        votesMap[vote._id] = vote;
      });
    }

    // 固定的投票选项
    const fixedOptions = [
      { id: "option1", text: "同意" },
      { id: "option2", text: "不同意" },
      { id: "option3", text: "弃权" },
    ];

    // 过滤掉已删除的投票记录，然后为每条记录添加投票信息和选项文本
    const enrichedRecords = records
      .filter((record) => votesMap[record.voteId])
      .map((record) => {
        const vote = votesMap[record.voteId];
        const option = fixedOptions.find((opt) => opt.id === record.optionId);

        return {
          ...record,
          voteTitle: vote.title,
          voteType: vote.type || "vote",
          voteStatus: vote.status || "unknown",
          voteDeadline: vote.deadlineTime,
          optionText: option ? option.text : "未知选项",
        };
      });

    return {
      success: true,
      data: enrichedRecords,
      total: enrichedRecords.length,
    };
  } catch (err) {
    console.error("getMyVoteRecords error:", err);
    return {
      success: false,
      error: err.message || "Failed to get vote records",
    };
  }
};
