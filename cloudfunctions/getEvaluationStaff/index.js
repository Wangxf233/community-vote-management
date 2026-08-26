const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 获取评价周期的服务人员列表
 * 用于小程序展示可评价的服务人员
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { cycleId, communityId } = event;

  try {
    if (!cycleId) {
      return { success: false, error: "缺少评价周期ID" };
    }

    if (!communityId) {
      return { success: false, error: "无法确定所属小区" };
    }

    // 获取评价周期信息
    const cycleResult = await db
      .collection("evaluation_cycles")
      .doc(cycleId)
      .get();

    if (!cycleResult.data) {
      return { success: false, error: "评价周期不存在" };
    }

    const cycle = cycleResult.data;

    // 小区隔离校验
    if (cycle.communityId && cycle.communityId !== communityId) {
      return { success: false, error: "无权查看该评价" };
    }

    // 获取周期中的服务人员信息
    const staffIds = cycle.staffIds || [];

    if (staffIds.length === 0) {
      return {
        success: true,
        data: {
          cycle: cycle,
          staff: [],
        },
      };
    }

    // 批量获取服务人员详情
    const staffResult = await db
      .collection("evaluation_staff")
      .where({
        _id: db.command.in(staffIds),
        status: "active",
      })
      .get();

    // 照片链接刷新：用 fileID 换取新的临时链接（避免上传时保存的 7 天链接过期）
    const pending = (staffResult.data || [])
      .map((s) => {
        let key = "";
        if (
          s.photoFileID &&
          typeof s.photoFileID === "string" &&
          s.photoFileID.startsWith("cloud://")
        ) {
          key = s.photoFileID;
        } else if (
          typeof s.photo === "string" &&
          s.photo.startsWith("cloud://")
        ) {
          key = s.photo;
        }
        return { staff: s, key };
      })
      .filter((p) => p.key);
    if (pending.length > 0) {
      try {
        const tmpRes = await cloud.getTempFileURL({
          fileList: pending.map((p) => p.key),
        });
        const urlMap = {};
        (tmpRes.fileList || []).forEach((f) => {
          if (f.fileID && (f.tempFileURL || f.download_url)) {
            urlMap[f.fileID] = f.download_url || f.tempFileURL;
          }
        });
        pending.forEach(({ staff, key }) => {
          if (urlMap[key]) staff.photo = urlMap[key];
        });
      } catch (e) {
        console.warn("照片链接刷新失败:", e.message);
      }
    }

    // 检查用户对每个人员是否已评价
    const staffWithStatus = await Promise.all(
      staffResult.data.map(async (staff) => {
        const evaluationResult = await db
          .collection("evaluations")
          .where({
            cycleId: cycleId,
            staffId: staff._id,
            openid: openid,
          })
          .count();

        return {
          ...staff,
          hasEvaluated: evaluationResult.total > 0,
        };
      })
    );

    return {
      success: true,
      data: {
        cycle: cycle,
        staff: staffWithStatus,
      },
    };
  } catch (error) {
    console.error("获取服务人员列表失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
