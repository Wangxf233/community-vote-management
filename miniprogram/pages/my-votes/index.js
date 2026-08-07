Page({
  data: {
    voteList: [],
    loading: true,
  },

  onLoad: function () {
    this.loadVoteList();
  },

  onShow: function () {
    this.loadVoteList();
  },

  // 加载投票记录列表
  loadVoteList: function () {
    const that = this;
    that.setData({ loading: true });

    const bindingStatus = getApp().globalData.bindingStatus || "none";
    if (bindingStatus === "guest") {
      const votes = [
        {
          _id: "guest-vote-1",
          title: "关于3号楼电梯更新方案表决",
          voteType: "vote",
          selectedOptionText: "同意",
          createdAt: "2026-03-16 19:30",
          voteDeadline: "2026-03-20 18:00",
        },
        {
          _id: "guest-vote-2",
          title: "小区共享充电桩建设问卷",
          voteType: "survey",
          selectedOptionText: "弃权",
          createdAt: "2026-03-10 10:12",
          voteDeadline: "2026-03-25 20:00",
        },
      ];

      that.setData({
        voteList: votes,
        loading: false,
      });
      return;
    }

    const app = getApp();
    const communityId = app.globalData.communityId || "";
    wx.cloud
      .callFunction({
        name: "getMyVoteRecords",
        data: { communityId },
      })
      .then((res) => {
        console.log("getMyVoteRecords result:", res);

        if (res.result && res.result.success) {
          const votes = res.result.data || [];

          // 格式化时间
          votes.forEach((vote) => {
            if (vote.createdAt) {
              vote.createdAt = that.formatDateTime(vote.createdAt);
            }
            if (vote.voteDeadline) {
              vote.voteDeadline = that.formatDateTime(vote.voteDeadline);
            }
          });

          that.setData({
            voteList: votes,
            loading: false,
          });
        } else {
          wx.showToast({
            title: res.result?.error || "加载失败",
            icon: "none",
          });
          that.setData({ loading: false });
        }
      })
      .catch((err) => {
        console.error("加载投票记录失败:", err);
        wx.showToast({
          title: "加载失败",
          icon: "none",
        });
        that.setData({ loading: false });
      });
  },

  // 查看投票详情
  viewVoteDetail: function (e) {
    const voteId = e.currentTarget.dataset.id;
    if (voteId) {
      wx.navigateTo({
        url: `/pages/vote-detail/index?id=${voteId}`,
      });
    }
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

  // 下拉刷新
  onPullDownRefresh: function () {
    this.loadVoteList();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },
});
