const app = getApp();

Page({
  data: {
    surveyList: [],
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
        content: "家属账号暂不支持问卷调查功能，请使用户主账号进行问卷调查",
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
    this.loadSurveyList();
  },

  onShow() {
    // 刷新问卷状态
    this.loadSurveyList(true);
  },

  loadSurveyList(refresh = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });

    // 临时：不传 communityId，查询所有问卷用于测试
    // 获取问卷列表
    wx.cloud.callFunction({
      name: "listVotes",
      data: {
        type: "survey",
      },
      success: (res) => {
        if (res.result.success) {
          const surveyList = res.result.data.map((item) => ({
            ...item,
            id: item._id,
            deadline: this.formatDeadline(item.deadlineTime),
            voteCount: item.participantCount || 0,
            description: item.detail || item.description || "",
            status: this.getSurveyStatus(item),
            statusText: this.getStatusText(item),
          }));

          this.setData({
            surveyList,
            loading: false,
            hasMore: false,
          });
        } else {
          console.error("获取问卷列表失败:", res.result.error);
          wx.showToast({
            title: res.result.error || "获取失败",
            icon: "none",
          });
          this.setData({ loading: false });
        }
      },
      fail: (err) => {
        console.error("加载问卷列表失败:", err);
        wx.showToast({
          title: "加载失败",
          icon: "none",
        });
        this.setData({ loading: false });
      },
    });
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

  getSurveyStatus(survey) {
    const now = new Date();
    const deadline = new Date(survey.deadlineTime);

    if (now > deadline) return "ended";
    if (survey.hasVoted) return "voted";
    return "ongoing";
  },

  getStatusText(survey) {
    const status = this.getSurveyStatus(survey);
    const statusMap = {
      ongoing: "进行中",
      ended: "已结束",
      voted: "已参与",
    };
    return statusMap[status];
  },

  navigateToSurveyDetail(e) {
    const surveyId = e.currentTarget.dataset.id;

    // 检查绑定状态，未绑定用户可以查看但不能参与问卷
    const app = getApp();
    const status = app.globalData.bindingStatus;

    // 游客模式可以浏览，问卷页面内部会再次检查权限
    wx.navigateTo({
      url: `/pages/vote-detail/index?id=${surveyId}&type=survey`,
    });
  },

  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData(
        {
          page: this.data.page + 1,
        },
        () => {
          this.loadSurveyList();
        }
      );
    }
  },

  onPullDownRefresh() {
    this.loadSurveyList(true);
    wx.stopPullDownRefresh();
  },
});
