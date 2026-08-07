const app = getApp();

Page({
  data: {
    currentCommunity: null,
    otherCommunities: [],
    allBindings: [],
  },

  onLoad() {
    this.loadUserCommunities();
  },

  onShow() {
    // 每次显示页面时刷新数据，以便在添加新小区后能看到更新
    this.loadUserCommunities();
  },

  /**
   * 加载用户的所有小区绑定
   */
  async loadUserCommunities() {
    const bindingStatus = app.globalData.bindingStatus || "none";
    if (bindingStatus === "guest") {
      const currentCommunity = {
        _id: "guest-binding-1",
        communityId: "guest-community-1",
        communityName: "星河苑",
        address: "杭州市滨江区江南大道1888号",
        status: "guest",
      };

      const otherCommunities = [
        {
          _id: "guest-binding-2",
          communityId: "guest-community-2",
          communityName: "湖畔嘉园",
          address: "杭州市西湖区文三路256号",
          status: "guest",
        },
      ];

      this.setData({
        currentCommunity,
        otherCommunities,
        allBindings: [currentCommunity, ...otherCommunities],
      });
      return;
    }

    try {
      wx.showLoading({
        title: "加载中...",
        mask: true,
      });

      // 调用云函数获取用户所有已审核通过的小区
      const res = await wx.cloud.callFunction({
        name: "getUserCommunities",
        data: {
          openid: app.globalData.openid,
        },
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        const bindings = res.result.bindings || [];
        const currentCommunityId = app.globalData.communityId;

        // 找到当前小区
        const current = bindings.find(
          (b) => b.communityId === currentCommunityId,
        );

        // 其他小区
        const others = bindings.filter(
          (b) => b.communityId !== currentCommunityId,
        );

        this.setData({
          currentCommunity: current || null,
          otherCommunities: others,
          allBindings: bindings,
        });
      } else {
        wx.showToast({
          title: res.result?.message || "加载失败",
          icon: "none",
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error("加载用户小区失败:", err);
      wx.showToast({
        title: "加载失败，请重试",
        icon: "none",
      });
    }
  },

  /**
   * 切换小区
   */
  async switchCommunity(e) {
    const bindingStatus = app.globalData.bindingStatus || "none";
    if (bindingStatus === "guest") {
      wx.showToast({
        title: "游客模式不支持切换",
        icon: "none",
      });
      return;
    }

    const { communityId, bindingId } = e.currentTarget.dataset;

    if (!communityId) {
      wx.showToast({
        title: "小区信息错误",
        icon: "none",
      });
      return;
    }

    try {
      wx.showLoading({
        title: "切换中...",
        mask: true,
      });

      // 找到对应的绑定信息
      const binding = this.data.allBindings.find((b) => b._id === bindingId);

      if (!binding) {
        wx.hideLoading();
        wx.showToast({
          title: "小区信息错误",
          icon: "none",
        });
        return;
      }

      // 更新全局数据
      app.globalData.communityId = communityId;
      app.globalData.bindingInfo = binding;
      app.globalData.bindingStatus = binding.status;

      // 更新本地存储
      wx.setStorageSync("communityId", communityId);
      wx.setStorageSync("bindingStatus", binding.status);

      wx.hideLoading();

      // 显示成功提示
      wx.showToast({
        title: "切换成功",
        icon: "success",
        duration: 1500,
      });

      // 跳转到首页并刷新全部数据
      setTimeout(() => {
        wx.reLaunch({
          url: "/pages/service/index",
        });
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      console.error("切换小区失败:", err);
      wx.showToast({
        title: "切换失败，请重试",
        icon: "none",
      });
    }
  },

  /**
   * 添加新小区
   */
  addNewCommunity() {
    wx.showActionSheet({
      itemList: ["户主", "家属", "工作人员"],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({
            url: "/pages/owner-register/index?isAdding=true",
          });
        } else if (res.tapIndex === 1) {
          wx.navigateTo({
            url: "/pages/family-register/index?isAdding=true",
          });
        } else if (res.tapIndex === 2) {
          wx.navigateTo({
            url: "/pages/staff-register/index",
          });
        }
      },
    });
  },
});
