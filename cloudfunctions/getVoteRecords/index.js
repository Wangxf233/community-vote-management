const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { voteId, page = 1, pageSize = 20 } = event;

  if (!voteId) {
    return { success: false, error: "voteId is required" };
  }

  try {
    // 获取投票基本信息
    const voteRes = await db.collection("votes").doc(voteId).get();
    if (!voteRes.data) {
      return { success: false, error: "投票不存在" };
    }

    const vote = voteRes.data;

    // 获取投票记录总数
    const countRes = await db
      .collection("vote_records")
      .where({ voteId })
      .count();

    const total = countRes.total || 0;

    // 获取投票记录
    const recordsRes = await db
      .collection("vote_records")
      .where({ voteId })
      .orderBy("createdAt", "desc")
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const records = recordsRes.data || [];

    // 固定的投票选项（旧投票数据无 options 字段时作为默认值）
    const fixedOptions = [
      { id: "option1", text: "同意" },
      { id: "option2", text: "不同意" },
      { id: "option3", text: "弃权" },
    ];

    // 优先使用投票创建时保存的选项定义（支持自定义选项）
    const optionDefs =
      Array.isArray(vote.options) && vote.options.length > 0
        ? vote.options
        : fixedOptions;

    // 为每条记录添加投票选项文本和转换签名图片链接
    const enrichedRecords = await Promise.all(
      records.map(async (record) => {
        const option = optionDefs.find((opt) => opt.id === record.optionId);

        // 只有旧数据（cloud:// 开头）才需要转换，新数据已经是 HTTPS 链接
        let signatureUrl = record.signatureUrl;
        if (signatureUrl && signatureUrl.startsWith("cloud://")) {
          try {
            const tempUrlRes = await cloud.getTempFileURL({
              fileList: [signatureUrl],
            });
            if (tempUrlRes.fileList && tempUrlRes.fileList[0]) {
              // 优先使用 download_url（永久链接），降级到 tempFileURL
              signatureUrl =
                tempUrlRes.fileList[0].download_url ||
                tempUrlRes.fileList[0].tempFileURL;
            }
          } catch (err) {
            console.error("获取签名图片链接失败:", err);
          }
        }

        return {
          ...record,
          signatureUrl,
          optionText: option ? option.text : "未知选项",
        };
      })
    );

    // 计算每个选项的统计数据
    const optionCounts = vote.optionCounts || {};
    const totalVotes = vote.totalVotes || 0;

    const options = optionDefs.map((option) => {
      const count = optionCounts[option.id] || 0;
      const percent =
        totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
      return {
        id: option.id,
        text: option.text,
        count,
        percent,
      };
    });

    return {
      success: true,
      data: enrichedRecords,
      total,
      voteTitle: vote.title,
      voteInitiator: vote.initiator,
      options,
    };
  } catch (err) {
    console.error("getVoteRecords error:", err);
    return {
      success: false,
      error: err.message || "获取投票记录失败",
    };
  }
};
