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
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadCommunityInfo().then(() => {
      wx.stopPullDownRefresh();
    });
  },
});
