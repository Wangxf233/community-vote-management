const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { code } = event;

  if (!code) {
    return { success: false, error: "missing_code" };
  }

  try {
    // 通过code获取手机号
    const res = await cloud.getOpenData({
      list: [code],
    });

    if (res && res.list && res.list.length > 0) {
      const phoneData = res.list[0].data;

      return {
        success: true,
        phoneNumber: phoneData.phoneNumber,
      };
    } else {
      return { success: false, error: "get_phone_failed" };
    }
  } catch (err) {
    console.error("获取手机号失败:", err);
    return { success: false, error: err.message || "unknown_error" };
  }
};
