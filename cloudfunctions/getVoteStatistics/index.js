const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

// 默认固定选项（旧投票数据无 options 字段时使用）
const FIXED_OPTIONS = [
  { id: "option1", text: "同意" },
  { id: "option2", text: "不同意" },
  { id: "option3", text: "弃权" },
];

function getVoteOptions(vote) {
  if (Array.isArray(vote.options) && vote.options.length > 0) {
    return vote.options;
  }
  return FIXED_OPTIONS;
}

exports.main = async (event, context) => {
  const { voteId } = event;

  if (!voteId) {
    return { success: false, error: "voteId is required" };
  }

  try {
    // 获取投票信息
    const voteRes = await db.collection("votes").doc(voteId).get();
    if (!voteRes.data) {
      return { success: false, error: "Vote not found" };
    }

    const vote = voteRes.data;

    // 并行执行三条聚合，全部在数据库侧完成，不拉取原始记录到内存
    const [ownerCountRes, ownerAreaRes, voteGroupRes] = await Promise.all([
      // 1. 去重户主数（按 openid 去重，排除空 openid）
      db
        .collection("owner_list")
        .aggregate()
        .match({
          communityId: vote.communityId,
          deleted: _.neq(true),
          openid: _.neq(""),
        })
        .group({ _id: "$openid" })
        .group({ _id: null, totalCount: $.sum(1) })
        .end(),

      // 2. 小区总专有面积（所有房产之和，保留多产权户的全部面积）
      db
        .collection("owner_list")
        .aggregate()
        .match({ communityId: vote.communityId, deleted: _.neq(true) })
        .group({ _id: null, totalArea: $.sum("$area") })
        .end(),

      // 3. 各选项投票人数和面积
      //    area 在投票时已从 owner_list 写入 vote_records，无需联表
      db
        .collection("vote_records")
        .aggregate()
        .match({ voteId, deleted: _.neq(true) })
        .group({ _id: "$optionId", count: $.sum(1), area: $.sum("$area") })
        .end(),
    ]);

    const totalCount =
      ownerCountRes.list && ownerCountRes.list[0]
        ? ownerCountRes.list[0].totalCount
        : 0;
    const totalArea =
      ownerAreaRes.list && ownerAreaRes.list[0]
        ? parseFloat((ownerAreaRes.list[0].totalArea || 0).toFixed(2))
        : 0;

    // 将聚合结果转为 optionId → { count, area } 映射
    const optionMap = {};
    (voteGroupRes.list || []).forEach((g) => {
      if (g._id) {
        optionMap[g._id] = {
          count: g.count || 0,
          area: parseFloat(g.area) || 0,
        };
      }
    });

    const pct = (n, d) => (d > 0 ? ((n / d) * 100).toFixed(1) : "0.0");

    // 按投票自身配置的选项生成统计（兼容固定选项与自定义选项）
    const options = getVoteOptions(vote);
    let participantCount = 0;
    let participantArea = 0;

    // 先累加原始值，最后统一四舍五入，避免各选项先行舍入导致合计误差
    const optionStats = options.map((opt) => {
      const stat = optionMap[opt.id] || { count: 0, area: 0 };
      participantCount += stat.count;
      participantArea += stat.area;
      return {
        id: opt.id,
        text: opt.text,
        count: stat.count,
        area: stat.area,
      };
    });

    participantArea = parseFloat(participantArea.toFixed(2));

    // 计算各选项占比（展示用面积保留两位小数）
    optionStats.forEach((opt) => {
      opt.percent = pct(opt.count, participantCount);
      opt.areaPercent = pct(opt.area, participantArea);
      opt.area = parseFloat(opt.area.toFixed(2));
    });

    // 兼容旧字段（固定选项时对应 同意/不同意/弃权；自定义投票不映射，置零避免错误标签）
    const isFixedMode = vote.optionMode !== "custom";
    const legacy = ["agree", "disagree", "abstain"].map((name, i) => {
      const stat =
        isFixedMode && optionStats[i]
          ? optionStats[i]
          : { count: 0, percent: "0.0", area: 0, areaPercent: "0.0" };
      return { name, stat };
    });

    const data = {
      totalCount,
      participantCount,
      participantRatio: pct(participantCount, totalCount),
      totalArea,
      participantArea,
      participantAreaRatio: pct(participantArea, totalArea),
      optionMode: vote.optionMode === "custom" ? "custom" : "fixed",
      // 各选项统计（固定选项与自定义选项通用）
      options: optionStats,
    };

    legacy.forEach(({ name, stat }) => {
      data[`${name}Count`] = stat.count;
      data[`${name}Percent`] = stat.percent;
      data[`${name}Area`] = stat.area.toFixed(2);
      data[`${name}AreaPercent`] = stat.areaPercent;
    });

    return {
      success: true,
      data,
    };
  } catch (err) {
    console.error("getVoteStatistics error:", err);
    return {
      success: false,
      error: err.message || "Failed to get statistics",
    };
  }
};
