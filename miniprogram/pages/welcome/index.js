Page({
  goToSelectIdentity() {
    wx.showActionSheet({
      itemList: ["户主", "家属", "工作人员"],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: "/pages/owner-register/index" });
        } else if (res.tapIndex === 1) {
          wx.navigateTo({ url: "/pages/family-register/index" });
        } else if (res.tapIndex === 2) {
          wx.navigateTo({ url: "/pages/staff-register/index" });
        }
      },
    });
  },

  enterAsGuest() {
    const app = getApp();
    app.globalData.bindingStatus = "guest";
    wx.setStorageSync("bindingStatus", "guest");
    wx.setStorageSync("hasSeenWelcome", true);
    wx.switchTab({ url: "/pages/service/index" });
  },
});
