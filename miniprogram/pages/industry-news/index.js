Page({
  data: {
    informationList: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    communityId: "",
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: "便民信息" });
    this.loadCommunityId();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true, informationList: [] });
    this.loadInformationList();
    setTimeout(() => wx.stopPullDownRefresh(), 1000);
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadInformationList();
    }
  },

  loadCommunityId() {
    const app = getApp();
    const bindingStatus = app.globalData.bindingStatus || "none";
    const communityId =
      app.globalData.communityId ||
      wx.getStorageSync("communityId") ||
      "guest-community";
    this.setData({ communityId });
    this.loadInformationList();
  },

  loadInformationList() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });

    const { page, pageSize, communityId } = this.data;

    wx.cloud
      .callFunction({
        name: "listAnnouncements",
        data: { communityId, page, pageSize, type: "industry" },
      })
      .then((res) => {
        if (res.result.success) {
          const newList = (res.result.data.list || []).map((item) => ({
            ...item,
            displayTime: this.formatTime(item.publishTime),
          }));
          const total = res.result.data.total || 0;
          this.setData({
            informationList:
              page === 1 ? newList : this.data.informationList.concat(newList),
            hasMore: this.data.informationList.length + newList.length < total,
            loading: false,
          });
        } else {
          wx.showToast({ title: res.result.error || "加载失败", icon: "none" });
          this.setData({ loading: false });
        }
      })
      .catch(() => {
        wx.showToast({ title: "加载失败", icon: "none" });
        this.setData({ loading: false });
      });
  },

  formatTime(publishTime) {
    if (!publishTime) return "";
    const now = new Date();
    const publish = new Date(publishTime);
    const diff = now - publish;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    return publish.toLocaleDateString("zh-CN");
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({ url: `/pages/information-detail/index?id=${id}` });
  },
});
