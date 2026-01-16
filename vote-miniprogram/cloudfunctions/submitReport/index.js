const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const {
    communityId,
    title,
    description,
    images = [],
    video = "",
    isUrgent = false,
    userId,
    userName,
  } = event;

  try {
    // 参数验证
    if (!communityId || !title || !description) {
      return {
        success: false,
        error: "缺少必填参数",
      };
    }

    // 直接写入云数据库
    const db = cloud.database();

    const reportData = {
      communityId,
      title,
      description,
      images,
      video,
      isUrgent,
      status: "pending", // pending, processing, completed
      remark: "",
      userId: userId || openid,
      openid: openid,
      userName,
      type: "report",
      submitTime: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("reports").add({
      data: reportData,
    });

    return {
      success: true,
      data: {
        _id: result._id,
        ...reportData,
      },
    };
  } catch (error) {
    console.error("提交报事失败:", error);
    return {
      success: false,
      error: error.message || "提交失败",
    };
  }
};
