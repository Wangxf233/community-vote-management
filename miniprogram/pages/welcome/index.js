Page({
  goToSelectIdentity() {
    wx.showModal({
      title: "选择身份",
      content: "请选择您的身份类型",
      confirmText: "户主",
      cancelText: "家属",
      success: (res) => {
        if (res.confirm) {
          // 户主注册
          wx.navigateTo({
            url: "/pages/owner-register/index",
          });
        } else if (res.cancel) {
          // 家属注册
          wx.navigateTo({
            url: "/pages/family-register/index",
          });
        }
      },
    });
  },

  enterAsGuest() {
    const app = getApp();
    app.globalData.bindingStatus = "guest";
    wx.setStorageSync("bindingStatus", "guest");
    wx.setStorageSync("hasSeenWelcome", true);

    wx.switchTab({
      url: "/pages/service/index",
    });
  },
});
