const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const {
    communityId,
    type,
    title,
    initiator,
    publishTimeStart,
    publishTimeEnd,
    deadlineTimeStart,
    deadlineTimeEnd,
  } = event;

  try {
    // 构建查询条件
    const query = {
      deleted: _.neq(true),
    };

    // 如果提供了 communityId 则过滤
    if (communityId) {
      query.communityId = communityId;
    }

    if (type) {
      query.type = type;
    }

    if (title) {
      query.title = db.RegExp({
        regexp: title,
        options: "i",
      });
    }

    if (initiator) {
      query.initiator = initiator;
    }

    if (publishTimeStart && publishTimeEnd) {
      query.publishTime = _.and(
        _.gte(new Date(publishTimeStart)),
        _.lte(new Date(publishTimeEnd))
      );
    }

    if (deadlineTimeStart && deadlineTimeEnd) {
      query.deadlineTime = _.and(
        _.gte(new Date(deadlineTimeStart)),
        _.lte(new Date(deadlineTimeEnd))
      );
    }

    const res = await db
      .collection("votes")
      .where(query)
      .orderBy("publishTime", "desc")
      .get();

    return {
      success: true,
      data: res.data,
      total: res.data.length,
    };
  } catch (err) {
    console.error("listVotes error:", err);
    return {
      success: false,
      error: err.message || "Failed to list votes",
    };
  }
};
