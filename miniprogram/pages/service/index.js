Page({
  data: {
    isGuest: false,
    bindingStatus: "none",
    propertyName: "物业服务", // 默认显示
    adImages: [], // 广告轮播图
  },

  onLoad() {
    this.checkBindStatus();
    this.loadPropertyName();
  },

  onShow() {
    this.checkBindStatus();
    this.loadPropertyName();
  },

  checkBindStatus() {
    const app = getApp();
    const bindingStatus = app.globalData.bindingStatus || "guest";
    this.setData({
      isGuest: bindingStatus === "guest",
      bindingStatus: bindingStatus,
    });
  },

  loadPropertyName() {
    const app = getApp();
    const bindingStatus = app.globalData.bindingStatus;

    // 所有用户都尝试加载物业名称，包括游客
    wx.cloud.callFunction({
      name: "getCommunityInfo",
      data: { communityId: app.globalData.communityId || "" },
      success: (res) => {
        if (res.result.success) {
          // 缓存实名认证开关状态（globalData + 本地存储双写）
          const app = getApp();
          const requireRealName = res.result.requireRealName !== false;
          app.globalData.requireRealName = requireRealName;
          wx.setStorageSync("requireRealName", requireRealName);
          if (res.result.data) {
            const data = res.result.data;
            this.setData({
              propertyName: data.propertyName || "物业服务",
              adImages: data.adImages || [],
            });
          }
        }
      },
      fail: (err) => {
        console.error("加载物业名称失败:", err);
      },
    });
  },

  navigateToVote() {
    this.checkAndNavigate("/pages/vote/index", "投票");
  },

  navigateToSurvey() {
    this.checkAndNavigate("/pages/survey/index", "问卷调查");
  },

  navigateToEvaluation() {
    this.checkAndNavigate("/pages/evaluation/index", "评价");
  },

  navigateToRepair() {
    this.checkAndNavigate("/pages/repair/index", "报修");
  },

  navigateToInformation() {
    // 信息公示不需要认证，所有用户都可以访问
    wx.navigateTo({ url: "/pages/information-categories/index" });
  },

  navigateToLaws() {
    wx.navigateTo({ url: "/pages/information-list/index?type=laws" });
  },

  navigateToIndustryNews() {
    wx.navigateTo({ url: "/pages/industry-news/index" });
  },

  navigateToBasicInfo() {
    wx.navigateTo({ url: "/pages/basic-info/index" });
  },

  checkAndNavigate(url, feature) {
    const app = getApp();
    const bindingStatus = app.globalData.bindingStatus || "guest";
    const bindingInfo = app.globalData.bindingInfo;

    // 检查是否是家属账号
    if (bindingInfo && bindingInfo.type === "family") {
      // 家属只能访问报修功能，不能使用投票、问卷调查和评价
      if (
        url.includes("/vote/") ||
        url.includes("/survey/") ||
        url.includes("/evaluation/")
      ) {
        wx.showModal({
          title: "功能限制",
          content: `家属账号暂不支持${feature}功能，请使用户主账号进行${feature}`,
          showCancel: false,
        });
        return;
      }
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
