const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { voteId, communityId } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!voteId) {
    return { success: false, error: "voteId is required" };
  }

  try {
    // 获取投票信息
    const voteRes = await db.collection("votes").doc(voteId).get();

    if (!voteRes.data) {
      return { success: false, error: "投票不存在" };
    }

    const vote = voteRes.data;

    // 小区隔离校验
    if (communityId && vote.communityId && vote.communityId !== communityId) {
      return { success: false, error: "无权查看该投票" };
    }

    // 调试日志：查看投票数据
    console.log("投票原始数据:", JSON.stringify(vote));
    console.log("投票选项:", vote.options);

    // 检查用户是否已投票
    const voteRecordRes = await db
      .collection("vote_records")
      .where({
        voteId,
        openid,
      })
      .get();

    const hasVoted = voteRecordRes.data && voteRecordRes.data.length > 0;
    const myRecord = hasVoted ? voteRecordRes.data[0] : null;

    // 判断投票状态
    const now = new Date();
    const deadline = new Date(vote.deadlineTime);
    let status = "ongoing";
    let statusText = "进行中";

    if (vote.status === "paused") {
      status = "paused";
      statusText = "已暂停";
    } else if (now > deadline) {
      status = "ended";
      statusText = "已结束";
    } else if (hasVoted) {
      status = "voted";
      statusText = "已投票";
    }

    // 计算选项统计
    const optionCounts = vote.optionCounts || {};
    const totalVotes = vote.totalVotes || 0;

    // 固定的三个投票选项
    const fixedOptions = [
      { id: "option1", text: "同意" },
      { id: "option2", text: "不同意" },
      { id: "option3", text: "弃权" },
    ];

    const options = fixedOptions.map((option) => {
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

    // 计算参与人数占比和参与面积占比
    let participantStats = {
      totalOwners: 0,
      participantCount: totalVotes,
      participantRatio: "0.0",
      totalArea: 0,
      participantArea: 0,
      areaRatio: "0.0",
    };

    try {
      // 获取该投票所属社区
      const communityId = vote.communityId;
      console.log("开始计算参与统计, communityId:", communityId);

      if (communityId) {
        // 查询户主名单获取总户主数和总面积
        const ownerListRes = await db
          .collection("owner_list")
          .where({
            communityId: communityId,
          })
          .get();

        console.log("查询到户主名单记录数:", ownerListRes.data.length);
        if (ownerListRes.data.length > 0) {
          console.log(
            "第一条owner_list数据:",
            JSON.stringify(ownerListRes.data[0])
          );
        }

        if (ownerListRes.data && ownerListRes.data.length > 0) {
          // 计算不重复的户主数（按openid去重，因为一个户主可能有多套房产）和总面积
          const uniqueOwners = new Set();
          let totalAreaSum = 0;
          let emptyOpenidCount = 0;

          ownerListRes.data.forEach((owner) => {
            const openid = owner.openid;
            // openid必须存在且不为空字符串
            if (openid && openid.trim() !== "") {
              uniqueOwners.add(openid);
            } else {
              emptyOpenidCount++;
            }
            // 累加所有房产的专有面积
            const area = parseFloat(owner.area) || 0;
            totalAreaSum += area;
          });

          console.log("空openid记录数:", emptyOpenidCount);
          console.log("唯一openid集合:", Array.from(uniqueOwners));

          participantStats.totalOwners = uniqueOwners.size;
          participantStats.totalArea = parseFloat(totalAreaSum.toFixed(2));

          console.log("总户主数:", uniqueOwners.size);
          console.log("总面积:", totalAreaSum);

          // 查询参与投票的记录，直接从 vote_records 获取参与的户主信息
          const voteRecordsRes = await db
            .collection("vote_records")
            .where({
              voteId: voteId,
            })
            .get();

          console.log("投票记录数:", voteRecordsRes.data.length);
          if (voteRecordsRes.data.length > 0) {
            console.log(
              "第一条vote_record数据:",
              JSON.stringify(voteRecordsRes.data[0])
            );
          }

          if (voteRecordsRes.data && voteRecordsRes.data.length > 0) {
            // 收集参与投票的openid（去重）
            const voterOpenids = new Set();
            voteRecordsRes.data.forEach((record) => {
              const openid = record.openid;
              // openid必须存在且不为空字符串
              if (openid && openid.trim() !== "") {
                voterOpenids.add(openid);
              }
            });

            console.log("参与投票的openid集合:", Array.from(voterOpenids));

            // 更新参与人数
            participantStats.participantCount = voterOpenids.size;

            // 计算人数占比
            if (uniqueOwners.size > 0) {
              participantStats.participantRatio = (
                (voterOpenids.size / uniqueOwners.size) *
                100
              ).toFixed(1);
            }

            // 计算参与投票户主的总面积（匹配openid，一个户主可能有多套房）
            let participantAreaSum = 0;
            ownerListRes.data.forEach((owner) => {
              const openid = owner.openid;
              if (openid && openid.trim() !== "" && voterOpenids.has(openid)) {
                const area = parseFloat(owner.area) || 0;
                participantAreaSum += area;
              }
            });

            participantStats.participantArea = parseFloat(
              participantAreaSum.toFixed(2)
            );

            console.log("参与投票户主总面积:", participantAreaSum);

            // 计算面积占比
            if (totalAreaSum > 0) {
              participantStats.areaRatio = (
                (participantAreaSum / totalAreaSum) *
                100
              ).toFixed(1);
            }
          }
        }
      }
    } catch (statsErr) {
      console.error("计算参与统计失败:", statsErr);
      // 即使统计失败也继续返回其他数据
    }

    // 格式化时间
    const formatTime = (dateStr) => {
      if (!dateStr) return "";
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day} ${hour}:${minute}`;
    };

    // 兼容 admin 前端使用的单附件字段（attachment/attachmentName）并优先使用 description 作为投票说明
    const attachments = [];
    if (Array.isArray(vote.attachments) && vote.attachments.length > 0) {
      attachments.push(...vote.attachments);
    } else if (vote.attachment) {
      attachments.push({
        url: vote.attachment,
        name: vote.attachmentName || "附件",
        size: vote.attachmentSize || "",
      });
    }

    // 构建返回数据
    // 将页面上“详情”优先显示存于 vote.detail 的内容；管理员填写的 description 放到 instruction 或备用字段
    const result = {
      id: vote._id,
      title: vote.title,
      // 详情页主说明使用原始的 detail 字段
      description: vote.detail || vote.description || "",
      // 保留管理员填写的说明到 instruction 供页面显示或备查
      instruction:
        vote.description ||
        vote.instruction ||
        "1. 每个业主只能投票一次\n2. 投票后不可更改\n3. 请在截止时间前完成投票",
      sponsor: vote.initiator || vote.sponsor || "未知",
      // 同时返回常用的时间字段名称，前端可直接使用 publishTime / deadlineTime
      publishTime: formatTime(vote.publishTime),
      deadlineTime: formatTime(vote.deadlineTime),
      // 兼容旧字段名
      deadline: formatTime(vote.deadlineTime),
      options,
      totalVotes,
      hasVoted,
      // 后端返回是否允许在小程序展示投票结果
      showResult: !!vote.showResult,
      status,
      statusText,
      attachments,
      // 添加参与统计信息
      participantStats,
    };

    // 如果已投票，添加投票记录信息
    if (hasVoted && myRecord) {
      const myOption = options.find((opt) => opt.id === myRecord.optionId);
      result.myVoteRecord = {
        optionText: myOption ? myOption.text : "未知选项",
        voteTime: formatTime(myRecord.createdAt),
      };
    }

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    console.error("getVoteDetail error:", err);
    return {
      success: false,
      error: err.message || "获取投票详情失败",
    };
  }
};
