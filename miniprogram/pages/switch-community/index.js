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
          (b) => b.communityId === currentCommunityId
        );

        // 其他小区
        const others = bindings.filter(
          (b) => b.communityId !== currentCommunityId
        );

        // 为每个小区添加完整地址
        const formatBinding = (binding) => {
          const region = binding.region || [];
          const district = binding.district || "";
          const building = binding.building || "";
          const unit = binding.unit || "";
          const room = binding.room || "";

          let address = region.join("");
          if (district) address += district;
          if (building) address += building;
          if (unit) address += unit;
          if (room) address += room;

          return {
            ...binding,
            fullAddress: address,
          };
        };

        this.setData({
          currentCommunity: current ? formatBinding(current) : null,
          otherCommunities: others.map(formatBinding),
          allBindings: bindings,
        });
      } else {
        wx.showToast({
          title: (res.result && res.result.message) || "加载失败",
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

      // 延迟后返回上一页并刷新
      setTimeout(() => {
        wx.navigateBack({
          delta: 1,
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
    wx.showModal({
      title: "选择身份",
      content: "请选择您在新小区的身份类型",
      confirmText: "户主",
      cancelText: "家属",
      success: (res) => {
        if (res.confirm) {
          // 户主注册
          wx.navigateTo({
            url: "/pages/owner-register/index?isAdding=true",
          });
        } else if (res.cancel) {
          // 家属注册
          wx.navigateTo({
            url: "/pages/family-register/index?isAdding=true",
          });
        }
      },
    });
  },
});
