const app = getApp();

Page({
  data: {
    userInfo: {
      name: "海阔天空",
      phone: "13581327100",
    },
    isOwner: false, // 是否是户主
    isStaff: false, // 是否是审核通过的工作人员
    staffPending: false, // 是否有待审核的工作人员申请
    bindingStatus: "none",
  },

  onLoad: function (options) {
    this.checkBindStatus();
    this.checkOwnerStatus();
  },

  onShow: function () {
    // 每次显示页面时刷新状态
    this.checkBindStatus();
    this.checkOwnerStatus();
    this.checkStaffStatus();
  },

  checkBindStatus() {
    const bindingStatus = app.globalData.bindingStatus || "none";
    this.setData({
      bindingStatus: bindingStatus,
    });
  },

  /**
   * 检查是否是户主
   */
  checkOwnerStatus: function () {
    const bindingInfo = app.globalData.bindingInfo;
    if (bindingInfo && bindingInfo.type === "owner") {
      this.setData({
        isOwner: true,
      });
    } else {
      this.setData({
        isOwner: false,
      });
    }
  },

  // 跳转到小区基本情况
  goToBasicInfo: function () {
    wx.navigateTo({
      url: "/pages/basic-info/index",
    });
  },

  // 跳转到我的房屋
  goToMyHouse: function () {
    wx.navigateTo({
      url: "/pages/my-house/index",
    });
  },

  // 跳转到我的家属（仅户主）
  goToMyFamily: function () {
    wx.navigateTo({
      url: "/pages/my-family/index",
    });
  },

  // 跳转到我的投票
  goToMyVotes: function () {
    wx.navigateTo({
      url: "/pages/my-votes/index",
    });
  },

  // 跳转到报修进度
  goToRepairProgress: function () {
    wx.navigateTo({
      url: "/pages/repair-progress/index",
    });
  },

  // 跳转到我的评价
  goToMyReviews: function () {
    wx.showToast({
      title: "我的评价",
      icon: "none",
    });
  },

  // 跳转到知识课堂
  goToKnowledge: function () {
    wx.showToast({
      title: "知识课堂",
      icon: "none",
    });
  },

  // 跳转到用户反馈
  goToFeedback: function () {
    wx.showToast({
      title: "用户反馈",
      icon: "none",
    });
  },

  // 跳转到联系我们
  goToContact: function () {
    wx.showToast({
      title: "联系我们",
      icon: "none",
    });
  },

  // 跳转到切换小区
  goToSettings: function () {
    wx.navigateTo({
      url: "/pages/switch-community/index",
    });
  },

  // 检查工作人员状态
  async checkStaffStatus() {
    try {
      const communityId = app.globalData.communityId || "";
      const res = await wx.cloud.callFunction({
        name: "getMyStaffStatus",
        data: { communityId },
      });
      if (res.result && res.result.success && res.result.data) {
        this.setData({
          isStaff: res.result.data.isApproved,
          staffPending: res.result.data.hasPending,
        });
      }
    } catch (err) {
      console.error("检查工作人员状态失败:", err);
    }
  },

  // 跳转到工作人员车辆查询
  goToVehicleQuery: function () {
    wx.navigateTo({
      url: "/pages/staff-vehicle-query/index",
    });
  },
});
