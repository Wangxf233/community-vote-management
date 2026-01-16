const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * getBindingInfo
 * - If event.mock is provided ('pending'|'failed'|'approved') returns canned data for testing
 * - Otherwise resolves current user by cloud.getWXContext().OPENID (or event.openid) and
 *   returns the most recent binding record from `bindings` collection.
 * Response shape:
 * { exists: boolean, bindingId?, info?: { communityName, region, building, block, room }, status?: 'pending'|'failed'|'approved', failReason?: string }
 */
exports.main = async (event, context) => {
  const mock = event && event.mock;
  if (mock === "pending") {
    return {
      exists: true,
      bindingId: "mock-pending-1",
      info: {
        communityName: "和平小区",
        region: ["广东省", "深圳市", "南山区"],
        building: "A座",
        block: "1单元",
        room: "101",
      },
      status: "pending",
      failReason: null,
    };
  }
  if (mock === "failed") {
    return {
      exists: true,
      bindingId: "mock-failed-1",
      info: {
        communityName: "阳光花园",
        region: ["广东省", "深圳市", "福田区"],
        building: "B座",
        block: "2单元",
        room: "202",
      },
      status: "failed",
      failReason: "证件信息不完整",
    };
  }
  if (mock === "approved") {
    return {
      exists: true,
      bindingId: "mock-approved-1",
      info: {
        communityName: "荣华小区",
        region: ["广东省", "深圳市", "南山区"],
        building: "C座",
        block: "3单元",
        room: "303",
      },
      status: "approved",
      failReason: null,
    };
  }

  try {
    const wxContext = cloud.getWXContext();
    const openid = (wxContext && wxContext.OPENID) || (event && event.openid);
    if (!openid) {
      return { success: false, error: "no_openid" };
    }

    // 查询认证申请表（排除已移出的记录）
    const certRes = await db
      .collection("certification_applications")
      .where({
        openid: openid,
        status: _.neq("removed"), // 排除已移出的记录
      })
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (certRes && certRes.data && certRes.data.length > 0) {
      const cert = certRes.data[0];
      return {
        success: true,
        binding: {
          _id: cert._id,
          type: cert.type || "owner",
          phone: cert.phone,
          name: cert.name,
          communityName: cert.communityName,
          communityId: cert.communityId,
          region: cert.region || [],
          district: cert.district || "",
          building: cert.building || "",
          unit: cert.unit || "",
          room: cert.room || "",
          relation: cert.relation || null,
          ownerOpenid: cert.ownerOpenid || null,
          ownerName: cert.ownerName || null,
          status: cert.status || "pending",
          rejectReason: cert.rejectReason || null,
          createdAt: cert.createdAt,
          updatedAt: cert.updatedAt,
        },
      };
    }

    // 没有找到认证记录
    return { success: true, binding: null };
  } catch (err) {
    console.error("getBindingInfo error", err);
    return { success: false, error: err.message };
  }
};
