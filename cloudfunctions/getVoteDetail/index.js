const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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

    // 固定的三个投票选项（旧投票数据无 options 字段时作为默认值）
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

    // 计算参与人数占比和参与面积占比
    // 优化：全部在数据库侧聚合，不再全量拉取 owner_list / vote_records（读放大修复）
    let participantStats = {
      totalOwners: 0,
      participantCount: totalVotes,
      participantRatio: "0.0",
      totalArea: 0,
      participantArea: 0,
      areaRatio: "0.0",
    };

    try {
      const communityId = vote.communityId;
      if (communityId) {
        const $ = db.command.aggregate;

        const [ownerCountRes, ownerAreaRes, voterCountRes, voterAreaRes] =
          await Promise.all([
            // 1. 总户主数：按 openid 去重（排除空 openid）
            db
              .collection("owner_list")
              .aggregate()
              .match({
                communityId,
                deleted: _.neq(true),
                openid: _.neq(""),
              })
              .group({ _id: "$openid" })
              .group({ _id: null, totalCount: $.sum(1) })
              .end(),

            // 2. 小区总专有面积
            db
              .collection("owner_list")
              .aggregate()
              .match({ communityId, deleted: _.neq(true) })
              .group({ _id: null, totalArea: $.sum("$area") })
              .end(),

            // 3. 参与人数：投票记录按 openid 去重（排除空 openid）
            db
              .collection("vote_records")
              .aggregate()
              .match({ voteId, deleted: _.neq(true), openid: _.neq("") })
              .group({ _id: "$openid" })
              .group({ _id: null, totalCount: $.sum(1) })
              .end(),

            // 4. 参与面积：投票时已将户主专有面积快照写入 vote_records.area，直接求和
            db
              .collection("vote_records")
              .aggregate()
              .match({ voteId, deleted: _.neq(true) })
              .group({ _id: null, totalArea: $.sum("$area") })
              .end(),
          ]);

        const totalOwners =
          ownerCountRes.list && ownerCountRes.list[0]
            ? ownerCountRes.list[0].totalCount
            : 0;
        const totalArea = ownerAreaRes.list && ownerAreaRes.list[0]
          ? parseFloat((ownerAreaRes.list[0].totalArea || 0).toFixed(2))
          : 0;
        const participantCount =
          voterCountRes.list && voterCountRes.list[0]
            ? voterCountRes.list[0].totalCount
            : 0;
        const participantArea =
          voterAreaRes.list && voterAreaRes.list[0]
            ? parseFloat((voterAreaRes.list[0].totalArea || 0).toFixed(2))
            : 0;

        participantStats.totalOwners = totalOwners;
        participantStats.totalArea = totalArea;
        participantStats.participantCount = participantCount;
        participantStats.participantArea = participantArea;

        if (totalOwners > 0) {
          participantStats.participantRatio = (
            (participantCount / totalOwners) *
            100
          ).toFixed(1);
        }
        if (totalArea > 0) {
          participantStats.areaRatio = (
            (participantArea / totalArea) *
            100
          ).toFixed(1);
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

    // 附件链接刷新：用 fileID 换取新的临时链接（避免上传时保存的 7 天链接过期）
    let attachmentUrl = vote.attachment || "";
    const convertKey =
      vote.attachmentFileID &&
      typeof vote.attachmentFileID === "string" &&
      vote.attachmentFileID.startsWith("cloud://")
        ? vote.attachmentFileID
        : typeof attachmentUrl === "string" &&
            attachmentUrl.startsWith("cloud://")
          ? attachmentUrl
          : "";
    if (convertKey) {
      try {
        const tmpRes = await cloud.getTempFileURL({
          fileList: [convertKey],
        });
        const f = tmpRes.fileList && tmpRes.fileList[0];
        if (f && (f.tempFileURL || f.download_url)) {
          attachmentUrl = f.download_url || f.tempFileURL;
        }
      } catch (e) {
        console.warn("附件链接刷新失败:", e.message);
      }
    }

    // 兼容 admin 前端使用的单附件字段（attachment/attachmentName）并优先使用 description 作为投票说明
    const attachments = [];
    if (Array.isArray(vote.attachments) && vote.attachments.length > 0) {
      attachments.push(...vote.attachments);
    } else if (attachmentUrl) {
      attachments.push({
        url: attachmentUrl,
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
