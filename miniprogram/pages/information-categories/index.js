Page({
  data: {
    bindingStatus: "none",
  },

  onLoad: function (options) {
    this.checkBindStatus();
  },

  onShow: function () {
    this.checkBindStatus();
  },

  checkBindStatus() {
    const app = getApp();
    const bindingStatus = app.globalData.bindingStatus || "none";
    this.setData({
      bindingStatus: bindingStatus,
    });
  },

  // 跳转到业委会信息列表
  goToCommitteeList: function () {
    if (this.checkPermission()) {
      wx.navigateTo({
        url: "/pages/information-list/index?type=committee",
        fail: function (err) {
          console.error("跳转失败:", err);
          wx.showToast({
            title: "页面加载失败",
            icon: "none",
          });
        },
      });
    }
  },

  // 跳转到物业信息列表
  goToPropertyList: function () {
    if (this.checkPermission()) {
      wx.navigateTo({
        url: "/pages/information-list/index?type=property",
        fail: function (err) {
          console.error("跳转失败:", err);
          wx.showToast({
            title: "页面加载失败",
            icon: "none",
          });
        },
      });
    }
  },

  // 跳转到法律法规列表
  goToLawsList: function () {
    if (this.checkPermission()) {
      wx.navigateTo({
        url: "/pages/information-list/index?type=laws",
        fail: function (err) {
          console.error("跳转失败:", err);
          wx.showToast({
            title: "页面加载失败",
            icon: "none",
          });
        },
      });
    }
  },

  // 检查权限
  checkPermission: function () {
    const app = getApp();
    const bindingStatus = app.globalData.bindingStatus || "none";

    if (bindingStatus === "pending") {
      wx.showModal({
        title: "温馨提示",
        content: "您的认证申请正在审核中，审核通过后即可查看此内容",
        showCancel: false,
      });
      return false;
    }

    if (bindingStatus === "rejected") {
      wx.showModal({
        title: "温馨提示",
        content: "您的认证申请未通过审核，请重新提交认证申请",
        confirmText: "重新提交",
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: "/pages/welcome/index",
            });
          }
        },
      });
      return false;
    }

    return true;
  },
});
