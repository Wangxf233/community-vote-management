const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { voteId, action, deadlineTime, optionId, signatureUrl } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!voteId) {
    return { success: false, error: "voteId is required" };
  }

  try {
    // 处理投票提交
    if (action === "submit" || optionId) {
      if (!optionId || !signatureUrl) {
        return {
          success: false,
          error: "optionId and signatureUrl are required for voting",
        };
      }

      // 获取户主信息
      const ownerRes = await db
        .collection("owner_list")
        .where({ openid })
        .get();

      if (!ownerRes.data || ownerRes.data.length === 0) {
        return { success: false, error: "未找到户主信息" };
      }

      const owner = ownerRes.data[0];

      // 检查是否已投票
      const voteRecordRes = await db
        .collection("vote_records")
        .where({
          voteId,
          openid,
        })
        .get();

      if (voteRecordRes.data && voteRecordRes.data.length > 0) {
        return { success: false, error: "您已经投过票了" };
      }

      // 保存投票记录
      const addRes = await db.collection("vote_records").add({
        data: {
          voteId,
          openid,
          optionId,
          signatureUrl,
          ownerName: owner.name,
          ownerPhone: owner.phone,
          district: owner.district || "",
          building: owner.building,
          unit: owner.unit,
          room: owner.room,
          area: owner.area || 0,
          properties: owner.properties || [],
          createdAt: new Date(),
        },
      });

      // 更新投票选项计数
      await db
        .collection("votes")
        .doc(voteId)
        .update({
          data: {
            [`optionCounts.${optionId}`]: _.inc(1),
            totalVotes: _.inc(1),
            updatedAt: new Date(),
          },
        });

      // 返回新增记录与更新后的统计，方便小程序直接更新界面
      const voteResAfter = await db.collection("votes").doc(voteId).get();
      const newRecord = addRes._id
        ? {
            _id: addRes._id,
            voteId,
            optionId,
            signatureUrl,
            ownerName: owner.name,
            ownerPhone: owner.phone,
            createdAt: new Date(),
          }
        : null;

      return {
        success: true,
        myVoteRecord: newRecord,
        optionCounts: voteResAfter.data
          ? voteResAfter.data.optionCounts || {}
          : {},
        totalVotes: voteResAfter.data ? voteResAfter.data.totalVotes || 0 : 0,
        showResult: voteResAfter.data ? !!voteResAfter.data.showResult : false,
      };
    }

    // 处理其他操作（暂停、恢复等）
    if (!action) {
      return { success: false, error: "action is required" };
    }

    const updateData = {
      updatedAt: new Date(),
    };

    if (action === "pause") {
      updateData.status = "paused";
    } else if (action === "resume") {
      updateData.status = "active";
    } else if (action === "updateDeadline" && deadlineTime) {
      updateData.deadlineTime = new Date(deadlineTime);
    } else if (action === "toggleShowResult") {
      // 需要先查询当前状态
      const voteRes = await db.collection("votes").doc(voteId).get();
      if (!voteRes.data) {
        return { success: false, error: "Vote not found" };
      }
      updateData.showResult =
        event.showResult !== undefined
          ? event.showResult
          : !voteRes.data.showResult;
    } else {
      return { success: false, error: "Invalid action" };
    }

    await db.collection("votes").doc(voteId).update({
      data: updateData,
    });

    return { success: true };
  } catch (err) {
    console.error("updateVote error:", err);
    return {
      success: false,
      error: err.message || "Failed to update vote",
    };
  }
};
