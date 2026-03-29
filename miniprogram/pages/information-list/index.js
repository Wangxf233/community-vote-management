Page({
  data: {
    type: "",
    pageTitle: "",
    informationList: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    communityId: "",
    isGuest: false,
  },

  onLoad(options) {
    const { type = "all" } = options;
    this.setData({ type });
    this.setPageTitle(type);
    this.loadCommunityId();
  },

  // 设置页面标题
  setPageTitle(type) {
    let pageTitle = "";
    switch (type) {
      case "committee":
        pageTitle = "业委会信息";
        break;
      case "property":
        pageTitle = "物业信息";
        break;
      case "law":
        pageTitle = "法律法规";
        break;
      default:
        pageTitle = "全部信息";
    }

    this.setData({ pageTitle });
    wx.setNavigationBarTitle({ title: pageTitle });
  },

  // 加载社区ID
  loadCommunityId() {
    const bindingStatus = getApp().globalData.bindingStatus || "none";
    if (bindingStatus === "guest") {
      this.setData({
        isGuest: true,
        communityId: "guest-community",
      });
      this.loadInformationList();
      return;
    }

    const app = getApp();
    const communityId =
      app.globalData.communityId || wx.getStorageSync("communityId");

    if (communityId) {
      this.setData({ communityId });
      this.loadInformationList();
    } else {
      wx.showToast({
        title: "请先绑定社区",
        icon: "none",
      });
    }
  },

  // 加载公告列表
  loadInformationList() {
    if (this.data.loading || !this.data.hasMore) {
      return;
    }

    this.setData({ loading: true });

    if (this.data.isGuest) {
      const all = this.getGuestInformationByType(this.data.type);
      const start = (this.data.page - 1) * this.data.pageSize;
      const end = start + this.data.pageSize;
      const newList = all.slice(start, end).map((item) => ({
        ...item,
        displayTime: this.formatTime(item.publishTime),
      }));

      this.setData({
        informationList:
          this.data.page === 1
            ? newList
            : this.data.informationList.concat(newList),
        hasMore: end < all.length,
        loading: false,
      });
      return;
    }

    const { type, page, pageSize, communityId } = this.data;
    const requestData = {
      communityId: communityId,
      page: page,
      pageSize: pageSize,
    };

    // 如果不是"全部"，添加类型筛选
    if (type !== "all") {
      requestData.type = type;
    }

    wx.cloud
      .callFunction({
        name: "listAnnouncements",
        data: requestData,
      })
      .then((res) => {
        if (res.result.success) {
          const newList = res.result.data.list || [];
          const total = res.result.data.total || 0;

          // 格式化时间
          const formattedList = newList.map((item) => ({
            ...item,
            displayTime: this.formatTime(item.publishTime),
          }));

          this.setData({
            informationList:
              page === 1
                ? formattedList
                : this.data.informationList.concat(formattedList),
            hasMore:
              this.data.informationList.length + formattedList.length < total,
            loading: false,
          });
        } else {
          wx.showToast({
            title: res.result.error || "加载失败",
            icon: "none",
          });
          this.setData({ loading: false });
        }
      })
      .catch((err) => {
        console.error("加载列表失败:", err);
        wx.showToast({
          title: "加载失败",
          icon: "none",
        });
        this.setData({ loading: false });
      });
  },

  // 格式化时间
  formatTime(publishTime) {
    const now = new Date();
    const publish = new Date(publishTime);
    const diff = now - publish;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    } else if (days < 30) {
      return `${days}天前`;
    } else {
      return publish.toLocaleDateString("zh-CN");
    }
  },

  getGuestInformationByType(type) {
    const all = [
      {
        _id: "guest-committee-1",
        type: "committee",
        title: "业委会关于公共收益季度公示的说明",
        content: "现对2026年第一季度公共收益收支情况进行公示，欢迎业主监督。",
        publishTime: "2026-03-15T10:00:00",
        publisher: "星河苑业主委员会",
        isPinned: true,
        isRead: false,
      },
      {
        _id: "guest-property-1",
        type: "property",
        title: "春季绿化养护及病虫害防治安排",
        content: "3月下旬将集中开展绿化修剪、补植和病虫害防治作业。",
        publishTime: "2026-03-14T15:30:00",
        publisher: "星河苑物业服务中心",
        isPinned: false,
        isRead: true,
      },
      {
        _id: "guest-laws-1",
        type: "laws",
        title: "《民法典》物业服务相关条款解读",
        content:
          "围绕物业服务合同、公共收益与维修资金使用等重点条款进行简要解读。",
        publishTime: "2026-03-12T09:20:00",
        publisher: "社区法务顾问",
        isPinned: false,
        isRead: true,
      },
    ];

    if (type === "all") return all;
    if (type === "law") return all.filter((item) => item.type === "laws");
    return all.filter((item) => item.type === type);
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset;

    if (!id) {
      wx.showToast({
        title: "获取信息ID失败",
        icon: "none",
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/information-detail/index?id=${id}`,
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1,
      hasMore: true,
      informationList: [],
    });
    this.loadInformationList();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({
        page: this.data.page + 1,
      });
      this.loadInformationList();
    }
  },
});
