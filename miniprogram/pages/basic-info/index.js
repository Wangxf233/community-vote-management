Page({
  data: {
    loading: true,
    communityInfo: null,
    communityName: "小区基本情况",
    error: null,
  },

  onLoad: function (options) {
    this.loadCommunityInfo();
  },

  /**
   * 加载小区基本情况
   */
  async loadCommunityInfo() {
    try {
      this.setData({ loading: true, error: null });

      const bindingStatus = getApp().globalData.bindingStatus || "none";
      if (bindingStatus === "guest") {
        this.setData({
          communityName: "星河苑小区",
          communityInfo: {
            address: "杭州市滨江区江南大道1888号",
            developer: "星河置业集团",
            propertyCompany: "星河苑物业服务中心",
            buildYear: "2021",
            buildingCount: 18,
            unitCount: 54,
            residentialCount: 1260,
            shopCount: 46,
            ownerCount: 1187,
            landArea: 168000,
            buildingArea: {
              residential: 236500,
              commercial: 18500,
            },
            exclusiveArea: {
              residential: 198200,
              commercial: 14200,
            },
            undergroundParkingArea: 38200,
            surfaceParkingCount: 186,
            undergroundParkingCount: 794,
            vehicleCount: 912,
            greenRate: "35%",
            parkingSpaces: 980,
            introduction:
              "星河苑小区由高层住宅与配套商业组成，设有儿童活动区、健身步道和社区服务驿站，支持线上报修与公告通知。",
            planImage:
              "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80",
            effectImage:
              "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=1200&q=80",
          },
          loading: false,
        });
        return;
      }

      const res = await wx.cloud.callFunction({
        name: "getCommunityInfo",
        data: {},
      });

      if (res.result.success) {
        this.setData({
          communityInfo: res.result.data,
          communityName: res.result.communityName || "小区基本情况",
          loading: false,
        });
      } else {
        this.setData({
          error: res.result.error || "获取小区信息失败",
          loading: false,
        });
      }
    } catch (err) {
      console.error("加载小区基本情况失败:", err);
      this.setData({
        error: "加载失败，请稍后重试",
        loading: false,
      });
    }
  },

  /**
   * 预览小区平面图
   */
  previewPlanImage() {
    const { communityInfo } = this.data;
    if (communityInfo && communityInfo.planImage) {
      wx.previewImage({
        urls: [communityInfo.planImage],
        current: communityInfo.planImage,
      });
    }
  },

  /**
   * 预览小区效果图
   */
  previewEffectImage() {
    const { communityInfo } = this.data;
    if (communityInfo && communityInfo.effectImage) {
      wx.previewImage({
        urls: [communityInfo.effectImage],
        current: communityInfo.effectImage,
      });
    }
  },

  /**
   * 预览社区资料图片
   */
  previewCommunityImage(e) {
    const url = e.currentTarget.dataset.url;
    const { communityInfo } = this.data;
    const urls = communityInfo.communityImages || [];
    wx.previewImage({ urls, current: url });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadCommunityInfo().then(() => {
      wx.stopPullDownRefresh();
    });
  },
});
