const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 确保违停集合存在（首次调用时自动创建，后续调用直接跳过）
let collectionReady = false;
async function ensureCollection() {
  if (collectionReady) return;
  try {
    await db.createCollection("parking_violations");
  } catch (err) {
    // 集合已存在等情况忽略
  }
  collectionReady = true;
}

/**
 * 上报违停照片
 * event: { plateNumber, communityId, photoFileID }
 * 每次上传为该车牌新增一条违停记录，seq 为该车牌累计违停次数
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { photoFileID } = event;
  let { communityId } = event;
  const plateNumber = event.plateNumber
    ? String(event.plateNumber).trim()
    : "";

  if (!openid) {
    return { success: false, error: "未获取到用户身份" };
  }
  if (!plateNumber) {
    return { success: false, error: "缺少车牌号" };
  }
  if (!photoFileID || typeof photoFileID !== "string" || !photoFileID.startsWith("cloud://")) {
    return { success: false, error: "照片上传失败，请重试" };
  }

  try {
    // 确保集合存在
    await ensureCollection();

    // 未传 communityId 时依次从绑定/工作人员/户主信息推断
    if (!communityId) {
      const bindingRes = await db
        .collection("bindings")
        .where({ openid, status: "approved" })
        .orderBy("createTime", "desc")
        .limit(1)
        .get();
      if (bindingRes.data && bindingRes.data.length > 0) {
        communityId = bindingRes.data[0].communityId;
      }
    }
    if (!communityId) {
      const staffRes = await db
        .collection("staff")
        .where({ openid, status: "approved" })
        .limit(1)
        .get();
      if (staffRes.data && staffRes.data.length > 0) {
        communityId = staffRes.data[0].communityId;
      }
    }
    if (!communityId) {
      const ownerRes = await db
        .collection("owner_list")
        .where({ openid })
        .limit(1)
        .get();
      if (ownerRes.data && ownerRes.data.length > 0) {
        communityId = ownerRes.data[0].communityId;
      }
    }
    if (!communityId) {
      return { success: false, error: "无法确定所属小区" };
    }

    // 校验该小区内存在该车牌号的车辆（保证违停记录与管理后台车辆列表匹配）
    const vehicleRes = await db
      .collection("vehicles")
      .where({ communityId, plateNumber })
      .limit(1)
      .get();
    if (!vehicleRes.data || vehicleRes.data.length === 0) {
      return { success: false, error: "未找到该车辆信息，无法记录违停" };
    }

    // 查询该车牌当前违停总数，确定本次序号
    const countRes = await db
      .collection("parking_violations")
      .where({ communityId, plateNumber })
      .count();

    const seq = (countRes.total || 0) + 1;

    const res = await db.collection("parking_violations").add({
      data: {
        communityId,
        plateNumber,
        photoFileID,
        openid,
        seq,
        createdAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        _id: res._id,
        seq,
        createdAt: new Date(),
      },
    };
  } catch (err) {
    console.error("reportParkingViolation error:", err);
    return {
      success: false,
      error: err.message || "上报违停失败",
    };
  }
};
