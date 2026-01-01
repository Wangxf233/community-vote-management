Page({
  data: {
    isGuest: false,
    bindingStatus: "none",
  },

  onLoad() {
    this.checkBindStatus();
  },

  onShow() {
    this.checkBindStatus();
  },

  checkBindStatus() {
    const app = getApp();
    const bindingStatus = app.globalData.bindingStatus || "guest";
    this.setData({
      isGuest: bindingStatus === "guest",
      bindingStatus: bindingStatus,
    });
  },

  navigateToVote() {
    this.checkAndNavigate("/pages/vote/index", "投票");
  },

  navigateToEvaluation() {
    this.checkAndNavigate("/pages/evaluation/index", "评价");
  },

  navigateToRepair() {
    this.checkAndNavigate("/pages/repair/index", "报修");
  },

  checkAndNavigate(url, feature) {
    const app = getApp();
    const bindingStatus = app.globalData.bindingStatus || "guest";
    const bindingInfo = app.globalData.bindingInfo;

    // 检查是否是家属账号
    if (bindingInfo && bindingInfo.type === "family") {
      // 家属只能访问报修功能，不能使用投票和评价
      if (url.includes("/vote/") || url.includes("/evaluation/")) {
        wx.showModal({
          title: "功能限制",
          content: `家属账号暂不支持${feature}功能，请使用户主账号进行${feature}`,
          showCancel: false,
        });
        return;
      }
    }

    if (bindingStatus === "guest") {
      wx.showModal({
        title: "温馨提示",
        content: "游客模式下无法使用此功能，是否立即绑定账号？",
        confirmText: "立即绑定",
        cancelText: "取消",
        success: (res) => {
          if (res.confirm) {
            this.goToBind();
          }
        },
      });
      return;
    }

    if (bindingStatus === "pending") {
      wx.showModal({
        title: "温馨提示",
        content: "您的认证申请正在审核中，审核通过后即可使用此功能",
        showCancel: false,
      });
      return;
    }

    wx.navigateTo({ url });
  },

  goToBind() {
    wx.navigateTo({
      url: "/pages/welcome/index",
    });
  },
});
