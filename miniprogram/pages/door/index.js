// 厂商错误码对照表（MQTT-HTTP接口文档 2.6 附表）
const FONDCARD_ERROR_MAP = {
  0: "成功",
  1000: "缺少参数",
  1001: "参数错误",
  1002: "数据库连接失败",
  1003: "管理用户不存在",
  1004: "管理用户已存在",
  1005: "设备不存在",
  1006: "设备已存在",
  1007: "权限用户不存在",
  1008: "权限用户已存在",
  1009: "keyid不存在",
  1010: "keyid已存在",
  1011: "数据长度或个数超出",
  1012: "密码错误",
  1013: "MQTT连接失败",
  1014: "设备不在线",
  1015: "操作太频繁，请稍后再试",
  1016: "CCID为空",
  1017: "正在批量注册",
  1018: "没有要注册的人脸",
  1019: "文件或照片不存在",
  1020: "时间段不存在",
  1021: "时间段已存在",
  1022: "文件大小超出限制",
  1023: "文件类型出错",
  1024: "二维码过期",
  1025: "模板文件不存在",
  1026: "平台或应用不存在",
  1027: "平台或应用已存在",
  1028: "系统正在维护中",
  1029: "文件已存在",
};

Page({
  data: {
    loading: false,
    devices: [],
    openingSerial: "",
    bindingStatus: "none",
    canUse: false,
  },

  // 根据厂商错误码获取错误原因
  getFondcardErrorMessage(code) {
    if (code === null || code === undefined) return "";
    return FONDCARD_ERROR_MAP[Number(code)] || `未知错误(${code})`;
  },

  onShow() {
    this.checkBindStatus();
    if (this.data.canUse) {
      this.loadDevices();
    }
  },

  checkBindStatus() {
    const app = getApp();
    const bindingStatus = app.globalData.bindingStatus || "guest";
    this.setData({
      bindingStatus,
      canUse: bindingStatus === "approved",
    });
  },

  async loadDevices() {
    this.setData({ loading: true });
    try {
      const app = getApp();
      const res = await wx.cloud.callFunction({
        name: "listDoorDevices",
        data: { communityId: app.globalData.communityId || "" },
      });

      if (!res.result || !res.result.success) {
        throw new Error((res.result && res.result.error) || "加载门禁设备失败");
      }

      this.setData({
        devices: res.result.data.devices || [],
      });
    } catch (error) {
      console.error("loadDevices error:", error);
      wx.showToast({
        title: error.message || "加载失败",
        icon: "none",
      });
      this.setData({ devices: [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onOpenDoor(e) {
    const serial = e.currentTarget.dataset.serial;
    if (!serial) {
      return;
    }

    this.setData({ openingSerial: serial });
    try {
      const app = getApp();
      const res = await wx.cloud.callFunction({
        name: "openDoor",
        data: {
          serial,
          communityId: app.globalData.communityId || "",
        },
      });

      if (!res.result || !res.result.success) {
        throw new Error((res.result && res.result.error) || "开门失败");
      }

      // 厂商返回错误码时，提示对应的错误原因
      const fondcardCode = res.result.data
        ? res.result.data.fondcardCode
        : null;
      if (
        fondcardCode !== null &&
        fondcardCode !== undefined &&
        Number(fondcardCode) !== 0
      ) {
        const errMsg = this.getFondcardErrorMessage(fondcardCode);
        wx.showToast({
          title: errMsg,
          icon: "none",
          duration: 2500,
        });
        return;
      }

      wx.showToast({
        title: "开门成功",
        icon: "success",
      });
    } catch (error) {
      console.error("openDoor error:", error);
      wx.showToast({
        title: error.message || "开门失败",
        icon: "none",
      });
    } finally {
      this.setData({ openingSerial: "" });
    }
  },

  goBind() {
    wx.navigateTo({
      url: "/pages/welcome/index",
    });
  },
});
