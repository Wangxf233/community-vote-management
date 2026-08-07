Page({
  data: {
    currentTab: "all",
    repairList: [],
    filteredList: [],
    loading: true,
  },

  onLoad: function (options) {
    this.loadRepairList();
  },

  onShow: function () {
    this.loadRepairList();
  },

  // 加载报修记录
  loadRepairList: function () {
    const that = this;
    that.setData({ loading: true });

    const bindingStatus = getApp().globalData.bindingStatus || "none";
    if (bindingStatus === "guest") {
      const repairs = [
        {
          _id: "guest-repair-1",
          type: "repair",
          category: "电路维修",
          content: "2单元10层公共走廊照明间歇性闪烁，夜间影响通行。",
          status: "processing",
          submitTime: "2026-03-16 08:30",
          submitTimeFormatted: "2026-03-16 08:30",
        },
        {
          _id: "guest-repair-2",
          type: "report",
          category: "环境卫生",
          content: "北门垃圾分类点异味较重，建议增加清运频次。",
          status: "completed",
          submitTime: "2026-03-12 14:20",
          submitTimeFormatted: "2026-03-12 14:20",
        },
      ];

      repairs.forEach((repair) => {
        repair.statusText = that.getStatusText(repair.status);
        repair.statusClass = that.getStatusClass(repair.status);
      });

      that.setData({
        repairList: repairs,
        loading: false,
      });
      that.filterList();
      return;
    }

    // 直接使用 openid 查询报修记录
    const app = getApp();
    wx.cloud
      .callFunction({
        name: "getMyRepairs",
        data: { communityId: app.globalData.communityId || "" },
      })
      .then((res) => {
        console.log("getMyRepairs result:", res);

        if (res.result && res.result.success) {
          const repairs = res.result.data || [];

          // 格式化时间和状态
          repairs.forEach((repair) => {
            if (repair.submitTime) {
              repair.submitTimeFormatted = that.formatDateTime(
                repair.submitTime,
              );
            }
            repair.statusText = that.getStatusText(repair.status);
            repair.statusClass = that.getStatusClass(repair.status);
          });

          that.setData({
            repairList: repairs,
            loading: false,
          });

          that.filterList();
        } else {
          wx.showToast({
            title: res.result?.error || "加载失败",
            icon: "none",
          });
          that.setData({ loading: false });
        }
      })
      .catch((err) => {
        console.error("加载报修记录失败:", err);
        wx.showToast({
          title: "加载失败",
          icon: "none",
        });
        that.setData({ loading: false });
      });
  },

  // 切换标签
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab,
    });
    this.filterList();
  },

  // 筛选列表
  filterList: function () {
    const { currentTab, repairList } = this.data;
    let filteredList = repairList;

    if (currentTab === "pending") {
      filteredList = repairList.filter((item) => item.status === "pending");
    } else if (currentTab === "processing") {
      filteredList = repairList.filter((item) => item.status === "processing");
    } else if (currentTab === "completed") {
      filteredList = repairList.filter(
        (item) => item.status === "completed" || item.status === "rejected",
      );
    }

    this.setData({
      filteredList: filteredList,
    });
  },

  // 查看报修详情
  viewDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/repair-detail/index?id=${id}`,
    });
  },

  // 返回上一页
  goBack: function () {
    wx.navigateBack();
  },

  // 跳转到报修页面
  goToRepair: function () {
    wx.navigateTo({
      url: "/pages/repair/index",
    });
  },

  // 格式化时间
  formatDateTime: function (timestamp) {
    if (!timestamp) return "";

    try {
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");

      return `${year}-${month}-${day} ${hour}:${minute}`;
    } catch (e) {
      return "";
    }
  },

  // 获取状态文本
  getStatusText: function (status) {
    const statusMap = {
      pending: "待处理",
      processing: "处理中",
      completed: "已完成",
      rejected: "已拒绝",
    };
    return statusMap[status] || "未知";
  },

  // 获取状态样式类
  getStatusClass: function (status) {
    return status || "pending";
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.loadRepairList();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },
});
