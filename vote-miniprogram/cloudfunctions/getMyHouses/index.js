const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    // 首先通过 openid 查询 owner_list 表
    let ownerListRes = await db
      .collection("owner_list")
      .where({
        openid: openid,
        deleted: _.neq(true),
      })
      .get();

    // 如果通过 openid 查到数据，直接返回
    if (ownerListRes.data && ownerListRes.data.length > 0) {
      return {
        success: true,
        data: ownerListRes.data,
      };
    }

    // 如果通过 openid 没查到，尝试通过 certification_applications 获取手机号，再查询 owner_list
    const certRes = await db
      .collection("certification_applications")
      .where({
        openid: openid,
        status: "approved",
        deleted: _.neq(true),
      })
      .get();

    if (certRes.data && certRes.data.length > 0) {
      const cert = certRes.data[0];
      const phone = cert.phone;

      // 通过手机号查询 owner_list
      if (phone) {
        ownerListRes = await db
          .collection("owner_list")
          .where({
            phone: phone,
            deleted: _.neq(true),
          })
          .get();

        if (ownerListRes.data && ownerListRes.data.length > 0) {
          return {
            success: true,
            data: ownerListRes.data,
          };
        }
      }
    }

    // 都没有数据，返回空数组
    return {
      success: true,
      data: [],
    };
  } catch (err) {
    console.error("getMyHouses error:", err);
    return {
      success: false,
      error: err.message || "Failed to get houses",
    };
  }
};
