const app = getApp();

Page({
  data: {
    voteList: [],
    page: 1,
    hasMore: true,
    loading: false,
    isGuest: false,
  },

  onLoad(options) {
    const bindingStatus = app.globalData.bindingStatus || "guest";
    this.setData({
      isGuest: bindingStatus === "guest",
    });

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

  loadVoteList(refresh = false) {
    if (this.data.loading) return;

    if (this.data.isGuest) {
      this.setData({
        voteList: this.getGuestMockVoteList(),
        loading: false,
        hasMore: false,
      });
      return;
    }

    this.setData({ loading: true });

    // 临时：不传 communityId，查询所有投票用于测试
    // 获取投票列表
    wx.cloud.callFunction({
      name: "listVotes",
      data: {
        type: "vote",
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

  getGuestMockVoteList() {
    return [
      {
        id: "guest-vote-1",
        title: "关于2026年度电梯维保单位续签的业主表决",
        description:
          "拟续签现有维保单位一年，费用与服务标准按现合同执行，请业主审议。",
        deadline: "2026-04-30",
        voteCount: 186,
        status: "ongoing",
        statusText: "进行中",
      },
      {
        id: "guest-vote-2",
        title: "关于3号楼架空层非机动车充电区改造方案表决",
        description:
          "对消防整改后的充电区布局、充电桩数量及夜间断电策略进行居民表决。",
        deadline: "2026-02-18",
        voteCount: 243,
        status: "ended",
        statusText: "已结束",
      },
    ];
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

    // 检查绑定状态，未绑定用户可以查看但不能投票
    const app = getApp();
    const status = app.globalData.bindingStatus;

    // 游客模式可以浏览，投票页面内部会再次检查权限
    wx.navigateTo({
      url: `/pages/vote-detail/index?id=${voteId}&type=vote`,
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
        },
      );
    }
  },

  onPullDownRefresh() {
    this.loadVoteList(true);
    wx.stopPullDownRefresh();
  },
});
