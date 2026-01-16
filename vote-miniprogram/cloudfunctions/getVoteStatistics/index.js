const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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

    console.log("Vote communityId:", vote.communityId);

    // 获取该小区的户主名单总数
    const ownerListRes = await db
      .collection("owner_list")
      .where({
        communityId: vote.communityId,
        deleted: _.neq(true),
      })
      .get();

    console.log("Owner list count:", ownerListRes.data.length);
    console.log("Sample owner:", ownerListRes.data[0]);

    const totalCount = ownerListRes.data.length;

    // 获取投票记录
    const recordsRes = await db
      .collection("vote_records")
      .where({
        voteId: voteId,
        deleted: _.neq(true),
      })
      .get();

    const records = recordsRes.data;

    console.log("Vote records:", JSON.stringify(records));

    // 统计参与人数和各选项人数（按openid分组，记录optionId和area）
    const participantMap = new Map(); // key: openid, value: {optionId, areas: []}

    for (const record of records) {
      const openid = record.openid;
      if (!openid) continue;

      if (!participantMap.has(openid)) {
        participantMap.set(openid, {
          optionId: record.optionId || record.choice,
          areas: [],
        });
      }

      // 收集该openid的所有area（可能一个业主有多条投票记录对应多套房产）
      if (record.area) {
        participantMap.get(openid).areas.push(parseFloat(record.area) || 0);
      }
    }

    console.log("Participant map:", Array.from(participantMap.entries()));

    const participantCount = participantMap.size;
    let agreeCount = 0;
    let disagreeCount = 0;
    let abstainCount = 0;

    // 统计专有面积（仅投票表决需要）
    let agreeArea = 0;
    let disagreeArea = 0;
    let abstainArea = 0;

    // 遍历每个参与者统计
    for (const [openid, data] of participantMap) {
      const optionId = data.optionId;
      const ownerTotalArea = data.areas.reduce((sum, area) => sum + area, 0);

      console.log(
        `Processing openid: ${openid}, optionId: ${optionId}, totalArea: ${ownerTotalArea}`
      );

      // 统计人数（option1=同意, option2=不同意, option3=弃权）
      if (optionId === "option1") {
        agreeCount++;
        if (vote.type === "vote") {
          agreeArea += ownerTotalArea;
        }
      } else if (optionId === "option2") {
        disagreeCount++;
        if (vote.type === "vote") {
          disagreeArea += ownerTotalArea;
        }
      } else if (optionId === "option3") {
        abstainCount++;
        if (vote.type === "vote") {
          abstainArea += ownerTotalArea;
        }
      }
    }

    // 计算百分比（基于参与人数）
    const agreePercent =
      participantCount > 0
        ? ((agreeCount / participantCount) * 100).toFixed(2)
        : 0;
    const disagreePercent =
      participantCount > 0
        ? ((disagreeCount / participantCount) * 100).toFixed(2)
        : 0;
    const abstainPercent =
      participantCount > 0
        ? ((abstainCount / participantCount) * 100).toFixed(2)
        : 0;

    // 计算专有面积百分比
    const totalArea = agreeArea + disagreeArea + abstainArea;
    const agreeAreaPercent =
      totalArea > 0 ? ((agreeArea / totalArea) * 100).toFixed(2) : 0;
    const disagreeAreaPercent =
      totalArea > 0 ? ((disagreeArea / totalArea) * 100).toFixed(2) : 0;
    const abstainAreaPercent =
      totalArea > 0 ? ((abstainArea / totalArea) * 100).toFixed(2) : 0;

    return {
      success: true,
      data: {
        totalCount,
        participantCount,
        agreeCount,
        disagreeCount,
        abstainCount,
        agreePercent,
        disagreePercent,
        abstainPercent,
        agreeArea: agreeArea.toFixed(2),
        disagreeArea: disagreeArea.toFixed(2),
        abstainArea: abstainArea.toFixed(2),
        agreeAreaPercent,
        disagreeAreaPercent,
        abstainAreaPercent,
      },
      // 调试信息
      debug: {
        recordsCount: records.length,
        sampleRecord: records[0],
        participantMapEntries: Array.from(participantMap.entries()),
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
