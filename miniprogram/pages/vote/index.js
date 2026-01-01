const app = getApp();

Page({
  data: {
    currentTab: 0, // 0: 投票表决, 1: 问卷调查
    voteList: [],
    page: 1,
    hasMore: true,
    loading: false,
  },

  onLoad(options) {
    // 检查是否是家属
    const bindingInfo = app.globalData.bindingInfo;
    if (bindingInfo && bindingInfo.type === "family") {
      wx.showModal({
        title: "功能限制",
        content: "家属账号暂不支持投票功能，请使用户主账号进行投票",
        showCancel: false,
        success: () => {
          wx.navigateBack({
            fail: () => {
              wx.switchTab({
                url: "/pages/service/index",
              });
            },
          });
        },
      });
      return;
    }
    this.loadVoteList();
  },

  onShow() {
    // 刷新投票状态
    this.loadVoteList(true);
  },

  switchTab(e) {
    const tab = parseInt(e.currentTarget.dataset.tab);
    if (tab !== this.data.currentTab) {
      this.setData(
        {
          currentTab: tab,
          page: 1,
          hasMore: true,
          voteList: [],
        },
        () => {
          this.loadVoteList(true);
        }
      );
    }
  },

  loadVoteList(refresh = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });

    const type = this.data.currentTab === 0 ? "vote" : "survey";

    // 临时：不传 communityId，查询所有投票用于测试
    // 获取投票列表
    wx.cloud.callFunction({
      name: "listVotes",
      data: {
        type,
      },
      success: (res) => {
        if (res.result.success) {
          const voteList = res.result.data.map((item) => ({
            ...item,
            id: item._id,
            deadline: this.formatDeadline(item.deadlineTime),
            voteCount: item.participantCount || 0,
            description: item.detail || item.description || "",
            status: this.getVoteStatus(item),
            statusText: this.getStatusText(item),
          }));

          this.setData({
            voteList,
            loading: false,
            hasMore: false,
          });
        } else {
          console.error("获取投票列表失败:", res.result.error);
          wx.showToast({
            title: res.result.error || "获取失败",
            icon: "none",
          });
          this.setData({ loading: false });
        }
      },
      fail: (err) => {
        console.error("加载投票列表失败:", err);
        wx.showToast({
          title: "加载失败",
          icon: "none",
        });
        this.setData({ loading: false });
      },
    });
  },

  getMockData() {
    const mockData = [];
    for (let i = 1; i <= 3; i++) {
      mockData.push({
        id: i,
        title: "停车场收费",
        description:
          "为了规范停车场管理，提高停车场使用效率，现就停车场收费方案进行投票。具体方案包括：\n\n1. 临时停车：首小时5元，后续每小时3元\n2. 月租停车：每月300元\n3. 业主优惠：业主享受8折优惠\n\n请各位业主认真考虑后投票。",
        deadline: "2025-3-3",
        voteCount: Math.floor(Math.random() * 100),
        hasVoted: Math.random() > 0.5,
        type: this.data.currentTab === 0 ? "vote" : "survey",
      });
    }
    return mockData;
  },

  formatDeadline(deadlineTime) {
    if (!deadlineTime) return "";
    try {
      const date = new Date(deadlineTime);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch (e) {
      return "";
    }
  },

  getVoteStatus(vote) {
    const now = new Date();
    const deadline = new Date(vote.deadlineTime);

    if (now > deadline) return "ended";
    if (vote.hasVoted) return "voted";
    return "ongoing";
  },

  getStatusText(vote) {
    const status = this.getVoteStatus(vote);
    const statusMap = {
      ongoing: "进行中",
      ended: "已结束",
      voted: "已投票",
    };
    return statusMap[status];
  },

  navigateToVoteDetail(e) {
    const voteId = e.currentTarget.dataset.id;
    const voteType = this.data.currentTab === 0 ? "vote" : "survey";

    // 检查绑定状态，未绑定用户可以查看但不能投票
    const app = getApp();
    const status = app.globalData.bindingStatus;

    // 游客模式可以浏览，投票页面内部会再次检查权限
    wx.navigateTo({
      url: `/pages/vote-detail/index?id=${voteId}&type=${voteType}`,
    });
  },

  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData(
        {
          page: this.data.page + 1,
        },
        () => {
          this.loadVoteList();
        }
      );
    }
  },

  onPullDownRefresh() {
    this.loadVoteList(true);
    wx.stopPullDownRefresh();
  },
});
