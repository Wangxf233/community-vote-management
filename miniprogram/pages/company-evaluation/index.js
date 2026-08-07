const app = getApp();

Page({
  data: {
    cycles: [], // 评价周期列表
    currentCycle: null, // 当前选中的评价周期
    dimensions: [], // 评价维度
    scores: {}, // 评分数据
    comment: "", // 留言内容
    loading: false,
    isViewMode: false, // 是否是查看模式（已完成评价）
    evaluationHistory: null, // 评价历史记录
  },

  onLoad(options) {
    // 检查是否是家属
    const bindingInfo = app.globalData.bindingInfo;
    if (bindingInfo && bindingInfo.type === "family") {
      wx.showModal({
        title: "功能限制",
        content: "家属账号暂不支持评价功能，请使用户主账号进行评价",
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

    // 加载评价周期
    this.loadEvaluationCycles();
  },

  // 加载评价周期列表
  async loadEvaluationCycles() {
    wx.showLoading({ title: "加载中..." });

    try {
      const app = getApp();
      const res = await wx.cloud.callFunction({
        name: "listCompanyEvaluationCycles",
        data: { communityId: app.globalData.communityId || "" },
      });

      if (res.result.success) {
        const cycles = res.result.data;

        if (cycles.length === 0) {
          wx.showToast({
            title: "暂无进行中的评价",
            icon: "none",
          });
          this.setData({ cycles: [], currentCycle: null });
          return;
        }

        // 显示周期列表
        this.setData({
          cycles: cycles,
          currentCycle: null,
        });
      } else {
        wx.showToast({
          title: res.result.error || "加载失败",
          icon: "none",
        });
      }
    } catch (error) {
      console.error("加载评价周期失败:", error);
      wx.showToast({
        title: "加载失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 选择评价周期
  selectCycle(e) {
    const index = e.currentTarget.dataset.index;
    const cycle = this.data.cycles[index];

    this.setData({
      currentCycle: cycle,
    });

    // 如果该周期已完成评价，则显示评价历史
    if (cycle.hasEvaluated) {
      this.loadEvaluationHistory(cycle._id);
    } else {
      // 初始化评分表单
      this.initEvaluationForm(cycle);
    }
  },

  // 初始化评价表单
  initEvaluationForm(cycle) {
    // 初始化评分对象
    const scores = {};
    cycle.dimensions.forEach((dim) => {
      scores[dim.name] = 0;
    });

    this.setData({
      dimensions: cycle.dimensions || [],
      scores: scores,
      comment: "",
      isViewMode: false,
    });
  },

  // 加载评价历史
  async loadEvaluationHistory(cycleId) {
    wx.showLoading({ title: "加载中..." });
    try {
      const app = getApp();
      const res = await wx.cloud.callFunction({
        name: "getMyCompanyEvaluations",
        data: { cycleId: cycleId, communityId: app.globalData.communityId || "" },
      });

      if (res.result.success) {
        const { cycle, evaluation } = res.result.data;

        this.setData({
          isViewMode: true,
          evaluationHistory: evaluation,
          dimensions: cycle.dimensions || [],
        });
      } else {
        wx.showToast({
          title: res.result.error || "加载失败",
          icon: "none",
        });
      }
    } catch (error) {
      console.error("加载评价历史失败:", error);
      wx.showToast({
        title: "加载失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 返回周期列表
  backToCyclesList() {
    this.setData({
      currentCycle: null,
      scores: {},
      comment: "",
      isViewMode: false,
      evaluationHistory: null,
    });
  },

  // 设置评分
  setScore(e) {
    const { dimension, score } = e.currentTarget.dataset;
    const scores = { ...this.data.scores };
    scores[dimension] = parseInt(score);
    this.setData({ scores });
  },

  // 输入留言
  onCommentInput(e) {
    this.setData({
      comment: e.detail.value,
    });
  },

  // 提交评价
  async submitEvaluation() {
    // 检查是否所有维度都已评分
    const { dimensions, scores, currentCycle } = this.data;
    const unratedDimensions = dimensions.filter(
      (dim) => !scores[dim.name] || scores[dim.name] === 0
    );

    if (unratedDimensions.length > 0) {
      wx.showToast({
        title: `请对"${unratedDimensions[0].name}"进行评分`,
        icon: "none",
      });
      return;
    }

    // 确认提交
    const confirmRes = await wx.showModal({
      title: "提示",
      content: "确认提交评价吗？提交后不可修改。",
      confirmText: "确认提交",
      cancelText: "再检查一下",
    });

    if (!confirmRes.confirm) {
      return;
    }

    wx.showLoading({ title: "提交中..." });

    try {
      const app = getApp();
      const res = await wx.cloud.callFunction({
        name: "submitCompanyEvaluation",
        data: {
          cycleId: currentCycle._id,
          scores: scores,
          comment: this.data.comment,
          communityId: app.globalData.communityId || "",
        },
      });

      if (res.result.success) {
        wx.showToast({
          title: "评价提交成功",
          icon: "success",
        });

        // 延迟后重新加载周期列表
        setTimeout(() => {
          this.loadEvaluationCycles();
        }, 1500);
      } else {
        wx.showToast({
          title: res.result.error || "提交失败",
          icon: "none",
        });
      }
    } catch (error) {
      console.error("提交评价失败:", error);
      wx.showToast({
        title: "提交失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },
});
