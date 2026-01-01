Page({
  data: {
    bindingStatus: "none",
    newMessageCount: 0,
    communityId: "",
    committeeList: [], // 业委会信息列表
    propertyList: [], // 物业信息列表
    lawsList: [], // 法律法规列表
    unreadCount: {
      committee: 0,
      property: 0,
      law: 0,
    },
  },

  onLoad: function (options) {
    this.checkBindStatus();
    this.loadCommunityId();
  },

  onShow: function () {
    this.checkBindStatus();
    if (this.data.communityId) {
      this.loadAllData();
    }
  },

  // 加载社区ID
  loadCommunityId: function () {
    const app = getApp();
    const communityId = app.globalData.communityId;

    if (communityId) {
      this.setData({ communityId });
      this.loadAllData();
    } else {
      // 如果没有社区ID，尝试从缓存获取
      const cachedCommunityId = wx.getStorageSync("communityId");
      if (cachedCommunityId) {
        this.setData({ communityId: cachedCommunityId });
        this.loadAllData();
      }
    }
  },

  // 加载所有数据
  loadAllData: function () {
    wx.showLoading({ title: "加载中..." });

    Promise.all([
      this.loadAnnouncements("committee", 3),
      this.loadAnnouncements("property", 3),
      this.loadAnnouncements("law", 4),
      this.loadUnreadCount(),
    ])
      .then(() => {
        wx.hideLoading();
      })
      .catch((err) => {
        console.error("加载数据失败:", err);
        wx.hideLoading();
        wx.showToast({
          title: "加载失败",
          icon: "none",
        });
      });
  },

  // 加载公告列表
  loadAnnouncements: function (type, limit = 10) {
    return new Promise((resolve, reject) => {
      wx.cloud
        .callFunction({
          name: "listAnnouncements",
          data: {
            communityId: this.data.communityId,
            type: type,
            page: 1,
            pageSize: limit,
          },
        })
        .then((res) => {
          if (res.result.success) {
            const list = res.result.data.list || [];
            const dataKey =
              type === "committee"
                ? "committeeList"
                : type === "property"
                ? "propertyList"
                : "lawsList";
            this.setData({ [dataKey]: list });
            resolve(list);
          } else {
            reject(new Error(res.result.error));
          }
        })
        .catch(reject);
    });
  },

  // 加载未读数量
  loadUnreadCount: function () {
    return new Promise((resolve, reject) => {
      wx.cloud
        .callFunction({
          name: "getUnreadAnnouncementCount",
          data: {
            communityId: this.data.communityId,
          },
        })
        .then((res) => {
          if (res.result.success) {
            const { unreadCount, byType } = res.result.data;
            this.setData({
              newMessageCount: unreadCount,
              unreadCount: byType,
            });
            resolve();
          } else {
            reject(new Error(res.result.error));
          }
        })
        .catch(reject);
    });
  },

  checkBindStatus() {
    const app = getApp();
    const bindingStatus = app.globalData.bindingStatus || "none";
    this.setData({
      bindingStatus: bindingStatus,
    });
  },

  onPullDownRefresh: function () {
    this.loadAllData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: "刷新成功",
        icon: "success",
        duration: 1000,
      });
    }, 800);
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

  // 跳转到消息列表页
  goToMessageList: function () {
    wx.navigateTo({
      url: "/pages/information-list/index?type=all",
      fail: function (err) {
        console.error("跳转失败:", err);
        wx.showToast({
          title: "页面加载失败",
          icon: "none",
        });
      },
    });
  },

  // 跳转到业委会信息列表
  goToCommitteeList: function () {
    if (this.checkPermission()) {
      wx.navigateTo({
        url: "/pages/information-list/index?type=committee",
        fail: function (err) {
          console.error("跳转失败:", err);
          wx.showToast({
            title: "页面加载失败",
            icon: "none",
          });
        },
      });
    }
  },

  // 跳转到物业信息列表
  goToPropertyList: function () {
    if (this.checkPermission()) {
      wx.navigateTo({
        url: "/pages/information-list/index?type=property",
        fail: function (err) {
          console.error("跳转失败:", err);
          wx.showToast({
            title: "页面加载失败",
            icon: "none",
          });
        },
      });
    }
  },

  // 跳转到法律法规列表
  goToLawsList: function () {
    if (this.checkPermission()) {
      wx.navigateTo({
        url: "/pages/information-list/index?type=laws",
        fail: function (err) {
          console.error("跳转失败:", err);
          wx.showToast({
            title: "页面加载失败",
            icon: "none",
          });
        },
      });
    }
  },

  // 检查权限
  checkPermission: function () {
    const app = getApp();
    const bindingStatus = app.globalData.bindingStatus || "none";

    if (bindingStatus === "pending") {
      wx.showModal({
        title: "温馨提示",
        content: "您的认证申请正在审核中，审核通过后即可查看此内容",
        showCancel: false,
      });
      return false;
    }

    if (bindingStatus === "rejected") {
      wx.showModal({
        title: "温馨提示",
        content: "您的认证申请未通过审核，请重新提交认证申请",
        confirmText: "重新提交",
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: "/pages/welcome/index",
            });
          }
        },
      });
      return false;
    }

    return true;
  },

  // 跳转到详情页
  goToDetail: function (e) {
    const { id, title } = e.currentTarget.dataset;

    if (!id) {
      wx.showToast({
        title: "参数错误",
        icon: "none",
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/information-detail/index?id=${id}`,
      success: function (res) {},
      fail: function (err) {
        console.error("跳转到详情页失败:", err);
        wx.showToast({
          title: "详情页加载失败",
          icon: "none",
          duration: 2000,
        });
      },
    });
  },

  // 备用方案：如果页面不存在，显示模拟详情
  showMockDetail: function (e) {
    const { id, type, title } = e.currentTarget.dataset;

    wx.showModal({
      title: title || "信息详情",
      content: `这是${title}的详细信息页面。\n\nID: ${id}\n类型: ${type}\n\n详细内容正在开发中...`,
      showCancel: false,
      confirmText: "知道了",
    });
  },

  // 长按复制功能
  onLongPress: function (e) {
    const { title } = e.currentTarget.dataset;
    if (title) {
      wx.setClipboardData({
        data: title,
        success: function () {
          wx.showToast({
            title: "标题已复制",
            icon: "success",
          });
        },
      });
    }
  },
});
