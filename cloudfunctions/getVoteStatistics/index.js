const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

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

    const agreeCount = (optionMap.option1 || {}).count || 0;
    const disagreeCount = (optionMap.option2 || {}).count || 0;
    const abstainCount = (optionMap.option3 || {}).count || 0;
    const participantCount = agreeCount + disagreeCount + abstainCount;

    const agreeArea = (optionMap.option1 || {}).area || 0;
    const disagreeArea = (optionMap.option2 || {}).area || 0;
    const abstainArea = (optionMap.option3 || {}).area || 0;
    const participantArea = parseFloat(
      (agreeArea + disagreeArea + abstainArea).toFixed(2)
    );

    const pct = (n, d) => (d > 0 ? ((n / d) * 100).toFixed(1) : "0.0");

    return {
      success: true,
      data: {
        totalCount,
        participantCount,
        participantRatio: pct(participantCount, totalCount),
        agreeCount,
        disagreeCount,
        abstainCount,
        agreePercent: pct(agreeCount, participantCount),
        disagreePercent: pct(disagreeCount, participantCount),
        abstainPercent: pct(abstainCount, participantCount),
        totalArea,
        participantArea,
        participantAreaRatio: pct(participantArea, totalArea),
        agreeArea: agreeArea.toFixed(2),
        disagreeArea: disagreeArea.toFixed(2),
        abstainArea: abstainArea.toFixed(2),
        agreeAreaPercent: pct(agreeArea, participantArea),
        disagreeAreaPercent: pct(disagreeArea, participantArea),
        abstainAreaPercent: pct(abstainArea, participantArea),
      },
    };
  } catch (err) {
    console.error("getVoteStatistics error:", err);
    return {
      success: false,
      error: err.message || "Failed to get statistics",
    };
  }
};
    const ownerListRes = await db
      .collection("owner_list")
      .where({
        communityId: vote.communityId,
        deleted: _.neq(true),
      })
      .get();

    console.log("Owner list count:", ownerListRes.data.length);

    // 计算总户主数（按openid去重）
    const uniqueOwners = new Set();
    let totalAreaSum = 0;

    ownerListRes.data.forEach((owner) => {
      const openid = owner.openid;
      if (openid && openid.trim() !== "") {
        uniqueOwners.add(openid);
      }
      // 累加所有房产的专有面积
      const area = parseFloat(owner.area) || 0;
      totalAreaSum += area;
    });

    const totalCount = uniqueOwners.size;
    const totalArea = parseFloat(totalAreaSum.toFixed(2));

    console.log("总户主数（去重后）:", totalCount);
    console.log("总专有面积:", totalArea);

    // 获取投票记录
    const recordsRes = await db
      .collection("vote_records")
      .where({
        voteId: voteId,
        deleted: _.neq(true),
      })
      .get();

    const records = recordsRes.data;
    const participantCount = records.length;

    console.log("Vote records:", participantCount);

    // 统计各选项人数
    let agreeCount = 0;
    let disagreeCount = 0;
    let abstainCount = 0;

    // 收集参与投票的openid用于计算面积
    const voterOpenids = new Set();

    records.forEach((record) => {
      const optionId = record.optionId || record.choice;
      const openid = record.openid;

      if (openid && openid.trim() !== "") {
        voterOpenids.add(openid);
      }

      // 统计人数（option1=同意, option2=不同意, option3=弃权）
      if (optionId === "option1") {
        agreeCount++;
      } else if (optionId === "option2") {
        disagreeCount++;
      } else if (optionId === "option3") {
        abstainCount++;
      }
    });

    // 计算人数百分比（基于参与人数）
    const agreePercent =
      participantCount > 0
        ? ((agreeCount / participantCount) * 100).toFixed(1)
        : "0.0";
    const disagreePercent =
      participantCount > 0
        ? ((disagreeCount / participantCount) * 100).toFixed(1)
        : "0.0";
    const abstainPercent =
      participantCount > 0
        ? ((abstainCount / participantCount) * 100).toFixed(1)
        : "0.0";

    // 计算参与人数比例
    const participantRatio =
      totalCount > 0
        ? ((participantCount / totalCount) * 100).toFixed(1)
        : "0.0";

    // 计算参与专有面积和各选项专有面积
    let participantAreaSum = 0;
    let agreeArea = 0;
    let disagreeArea = 0;
    let abstainArea = 0;

    if (vote.type === "vote") {
      // 建立openid到选项的映射
      const openidToOption = {};
      records.forEach((record) => {
        openidToOption[record.openid] = record.optionId || record.choice;
      });

      // 遍历owner_list计算面积
      ownerListRes.data.forEach((owner) => {
        const openid = owner.openid;
        if (openid && openid.trim() !== "" && voterOpenids.has(openid)) {
          const area = parseFloat(owner.area) || 0;
          participantAreaSum += area;

          // 根据选项累加面积
          const optionId = openidToOption[openid];
          if (optionId === "option1") {
            agreeArea += area;
          } else if (optionId === "option2") {
            disagreeArea += area;
          } else if (optionId === "option3") {
            abstainArea += area;
          }
        }
      });
    }

    const participantArea = parseFloat(participantAreaSum.toFixed(2));

    // 计算参与面积比例
    const participantAreaRatio =
      totalArea > 0 ? ((participantArea / totalArea) * 100).toFixed(1) : "0.0";

    // 计算专有面积百分比（基于参与面积）
    const agreeAreaPercent =
      participantArea > 0
        ? ((agreeArea / participantArea) * 100).toFixed(1)
        : "0.0";
    const disagreeAreaPercent =
      participantArea > 0
        ? ((disagreeArea / participantArea) * 100).toFixed(1)
        : "0.0";
    const abstainAreaPercent =
      participantArea > 0
        ? ((abstainArea / participantArea) * 100).toFixed(1)
        : "0.0";

    return {
      success: true,
      data: {
        totalCount,
        participantCount,
        participantRatio,
        agreeCount,
        disagreeCount,
        abstainCount,
        agreePercent,
        disagreePercent,
        abstainPercent,
        totalArea,
        participantArea,
        participantAreaRatio,
        agreeArea: agreeArea.toFixed(2),
        disagreeArea: disagreeArea.toFixed(2),
        abstainArea: abstainArea.toFixed(2),
        agreeAreaPercent,
        disagreeAreaPercent,
        abstainAreaPercent,
      },
    };
  } catch (err) {
    console.error("getVoteStatistics error:", err);
    return {
      success: false,
      error: err.message || "Failed to get statistics",
    };
  }
};
