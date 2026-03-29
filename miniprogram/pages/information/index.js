Page({
  data: {
    bindingStatus: "none",
    communityId: "",
    notificationList: [], // 通知公告列表
    page: 1,
    pageSize: 10,
    hasMore: true,
    isGuest: false,
  },

  onLoad: function (options) {
    this.checkBindStatus();
    if (this.data.isGuest) {
      this.setData({ communityId: "guest-community" });
      this.loadNotifications(true);
      return;
    }
    this.loadCommunityId();
  },

  onShow: function () {
    this.checkBindStatus();
    if (this.data.isGuest) {
      this.loadNotifications(true);
      return;
    }
    if (this.data.communityId) {
      this.loadNotifications(true);
    }
  },

  // 加载社区ID
  loadCommunityId: function () {
    const app = getApp();
    const communityId = app.globalData.communityId;

    if (communityId) {
      this.setData({ communityId });
      this.loadNotifications(true);
    } else {
      // 如果没有社区ID，尝试从缓存获取
      const cachedCommunityId = wx.getStorageSync("communityId");
      if (cachedCommunityId) {
        this.setData({ communityId: cachedCommunityId });
        this.loadNotifications(true);
      }
    }
  },

  // 加载通知公告列表
  loadNotifications: function (reset = false) {
    if (reset) {
      this.setData({ page: 1, notificationList: [], hasMore: true });
    }

    if (!this.data.hasMore) return;

    if (this.data.isGuest) {
      const all = this.getGuestNotificationSource();
      const start = (this.data.page - 1) * this.data.pageSize;
      const end = start + this.data.pageSize;
      const list = all.slice(start, end);
      const newList = reset ? list : this.data.notificationList.concat(list);

      this.setData({
        notificationList: newList,
        hasMore: end < all.length,
        page: this.data.page + 1,
      });
      return;
    }

    wx.showLoading({ title: "加载中..." });

    wx.cloud
      .callFunction({
        name: "listAnnouncements",
        data: {
          communityId: this.data.communityId,
          type: "notification",
          page: this.data.page,
          pageSize: this.data.pageSize,
        },
      })
      .then((res) => {
        wx.hideLoading();
        if (res.result.success) {
          const list = res.result.data.list || [];
          const newList = reset
            ? list
            : this.data.notificationList.concat(list);

          this.setData({
            notificationList: newList,
            hasMore: list.length >= this.data.pageSize,
            page: this.data.page + 1,
          });
        } else {
          wx.showToast({
            title: res.result.error || "加载失败",
            icon: "none",
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("加载通知失败:", err);
        wx.showToast({
          title: "加载失败",
          icon: "none",
        });
      });
  },

  checkBindStatus() {
    const app = getApp();
    const bindingStatus = app.globalData.bindingStatus || "none";
    this.setData({
      bindingStatus: bindingStatus,
      isGuest: bindingStatus === "guest",
    });
  },

  getGuestNotificationSource() {
    return [
      {
        _id: "guest-notice-1",
        title: "关于清明节前园区安全巡查的通知",
        content:
          "物业将于3月20日至3月22日开展公共区域安全巡查，请住户配合保持消防通道畅通。",
        publisher: "物业公司",
        publishTime: "2026-03-17T09:00:00",
        isPinned: true,
        attachments: [
          {
            name: "巡查安排表.pdf",
            type: "doc",
            url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          },
        ],
      },
      {
        _id: "guest-notice-2",
        title: "地下车库照明分区检修公告",
        content:
          "3月19日10:00-16:00将对B1、B2部分照明线路检修，期间请减速慢行并注意指示标识。",
        publisher: "物业公司",
        publishTime: "2026-03-16T14:20:00",
        isPinned: false,
        attachments: [],
      },
      {
        _id: "guest-notice-3",
        title: "2026年第一季度物业服务质量回访安排",
        content: "客服管家将分楼栋开展入户回访，收集住户意见并形成改进清单。",
        publisher: "业委会",
        publishTime: "2026-03-14T18:30:00",
        isPinned: false,
        attachments: [],
      },
    ];
  },

  onPullDownRefresh: function () {
    this.loadNotifications(true);
    setTimeout(() => {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: "刷新成功",
        icon: "success",
        duration: 1000,
      });
    }, 800);
  },

  // 上拉加载更多
  onReachBottom: function () {
    this.loadNotifications(false);
  },

  // 查看通知详情
  goToDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/information-detail/index?id=${id}&type=notification`,
    });
  },

  // 格式化时间
  formatTime: function (publishTime) {
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
});
