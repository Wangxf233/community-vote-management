Page({
  data: {
    loading: false,
    devices: [],
    openingSerial: "",
    bindingStatus: "none",
    canUse: false,
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

      wx.showToast({
        title: "已发送开门指令",
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
