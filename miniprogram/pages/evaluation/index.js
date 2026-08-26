const app = getApp();

Page({
  data: {
    currentTab: 0, // 0: 服务人员, 1: 物业公司
    cycles: [], // 评价周期列表
    currentCycle: null, // 当前选中的评价周期
    staffList: [], // 服务人员列表
    selectedStaff: null, // 选中的服务人员
    dimensions: [], // 评价维度
    scores: {}, // 评分数据
    comment: "", // 留言内容
    showStaffModal: false, // 显示人员选择弹窗
    loading: false,
    isViewMode: false, // 是否是查看模式（已完成评价）
    evaluationHistory: [], // 评价历史记录
    isGuest: false,
  },

  onLoad(options) {
    const bindingStatus = app.globalData.bindingStatus || "guest";
    if (bindingStatus === "guest") {
      this.setData({
        isGuest: true,
      });
      this.loadGuestEvaluationData();
      return;
    }

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

    if (options.tab) {
      this.setData({
        currentTab: parseInt(options.tab),
      });
    }

    // 加载评价周期
    this.loadEvaluationCycles();
  },

  // 加载评价周期列表
  async loadEvaluationCycles() {
    wx.showLoading({ title: "加载中..." });

    try {
      // 根据当前tab调用不同的云函数
      const functionName =
        this.data.currentTab === 0
          ? "listEvaluationCycles" // 服务人员
          : "listCompanyEvaluationCycles"; // 物业公司

      const app = getApp();
      const res = await wx.cloud.callFunction({
        name: functionName,
        data: { communityId: app.globalData.communityId || "" },
      });

      if (res.result.success) {
        // 截止时间格式化为标准显示格式（YYYY-MM-DD HH:mm）
        const cycles = (res.result.data || []).map((cycle) => ({
          ...cycle,
          deadline: this.formatTime(cycle.deadline),
        }));

        if (cycles.length === 0) {
          wx.showToast({
            title: "暂无进行中的评价",
            icon: "none",
          });
          this.setData({ cycles: [], currentCycle: null });
          return;
        }

        // 显示周期列表，不自动选择
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

  // 加载服务人员列表
  async loadStaffList(cycleId) {
    try {
      const app = getApp();
      const res = await wx.cloud.callFunction({
        name: "getEvaluationStaff",
        data: { cycleId: cycleId, communityId: app.globalData.communityId || "" },
      });

      if (res.result.success) {
        const { cycle, staff } = res.result.data;

        this.setData({
          staffList: staff,
          dimensions: cycle.dimensions || [],
          currentCycle: {
            ...cycle,
            // 截止时间格式化为标准显示格式（YYYY-MM-DD HH:mm）
            deadline: this.formatTime(cycle.deadline),
          },
        });

        // 初始化评分对象
        const scores = {};
        cycle.dimensions.forEach((dim) => {
          scores[dim.name] = 0;
        });
        this.setData({ scores });
      } else {
        wx.showToast({
          title: res.result.error || "加载人员失败",
          icon: "none",
        });
      }
    } catch (error) {
      console.error("加载服务人员失败:", error);
      wx.showToast({
        title: "加载人员失败",
        icon: "none",
      });
    }
  },

  switchTab(e) {
    const tab = parseInt(e.currentTarget.dataset.tab);
    if (tab !== this.data.currentTab) {
      if (this.data.isGuest) {
        this.setData(
          {
            currentTab: tab,
            currentCycle: null,
            selectedStaff: null,
            cycles: [],
            staffList: [],
            scores: {},
            comment: "",
            isViewMode: false,
            evaluationHistory: [],
          },
          () => {
            this.loadGuestEvaluationData();
          },
        );
        return;
      }

      // 切换tab并重置状态，重新加载对应类型的评价周期
      this.setData(
        {
          currentTab: tab,
          currentCycle: null,
          selectedStaff: null,
          cycles: [],
          staffList: [],
          scores: {},
          comment: "",
          isViewMode: false,
          evaluationHistory: [],
        },
        () => {
          // 重新加载评价周期
          this.loadEvaluationCycles();
        },
      );
    }
  },

  // 选择评价周期
  selectCycle(e) {
    const index = e.currentTarget.dataset.index;
    const cycle = this.data.cycles[index];

    if (this.data.isGuest) {
      const dimensions = cycle.dimensions || [];
      const scores = {};
      dimensions.forEach((dim) => {
        scores[dim.name] = 0;
      });

      this.setData({
        currentCycle: cycle,
        dimensions,
        scores,
      });
      return;
    }

    this.setData({
      currentCycle: cycle,
    });

    // 如果该周期已完成所有评价，则显示评价历史
    if (cycle.hasEvaluated) {
      this.loadEvaluationHistory(cycle._id);
    } else {
      // 服务人员评价需要加载人员列表，物业公司评价不需要
      if (this.data.currentTab === 0) {
        this.loadStaffList(cycle._id);
      } else {
        // 物业公司评价：直接初始化评分
        const dimensions = cycle.dimensions || [];
        const scores = {};
        dimensions.forEach((dim) => {
          scores[dim.name] = 0;
        });
        this.setData({
          dimensions: dimensions,
          scores: scores,
        });
      }
    }
  },

  // 加载评价历史
  async loadEvaluationHistory(cycleId) {
    wx.showLoading({ title: "加载中..." });
    try {
      // 根据当前tab调用不同的云函数
      const functionName =
        this.data.currentTab === 0
          ? "getMyEvaluations" // 服务人员
          : "getMyCompanyEvaluations"; // 物业公司

      const app = getApp();
      const res = await wx.cloud.callFunction({
        name: functionName,
        data: { cycleId: cycleId, communityId: app.globalData.communityId || "" },
      });

      if (res.result.success) {
        const { cycle, evaluations } = res.result.data;

        // 格式化评价记录的时间
        const formattedEvaluations = evaluations.map((evaluation) => ({
          ...evaluation,
          createdAt: this.formatTime(evaluation.createdAt),
        }));

        this.setData({
          isViewMode: true,
          evaluationHistory: formattedEvaluations,
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
      selectedStaff: null,
      staffList: [],
      scores: {},
      comment: "",
      isViewMode: false,
      evaluationHistory: [],
    });
  },

  // 打开人员选择弹窗
  openStaffSelector() {
    if (this.data.staffList.length === 0) {
      wx.showToast({
        title: "暂无可评价的服务人员",
        icon: "none",
      });
      return;
    }
    this.setData({
      showStaffModal: true,
    });
  },

  // 关闭人员选择弹窗
  closeStaffModal() {
    this.setData({
      showStaffModal: false,
    });
  },

  // 阻止冒泡
  stopPropagation() {},

  // 选择服务人员
  selectStaff(e) {
    const index = e.currentTarget.dataset.index;
    const staff = this.data.staffList[index];

    if (staff.hasEvaluated) {
      wx.showToast({
        title: "您已评价过该人员",
        icon: "none",
      });
      return;
    }

    // 重置评分
    const scores = {};
    this.data.dimensions.forEach((dim) => {
      scores[dim.name] = 0;
    });

    this.setData({
      selectedStaff: staff,
      scores: scores,
      comment: "",
      showStaffModal: false,
    });
  },

  // 设置评分
  setScore(e) {
    // 如果是查看模式，不允许修改
    if (this.data.isViewMode) {
      wx.showToast({
        title: "已完成评价",
        icon: "none",
      });
      return;
    }

    const { dimension } = e.currentTarget.dataset;
    const score = parseInt(e.currentTarget.dataset.score);

    const scores = { ...this.data.scores };
    scores[dimension] = score;

    this.setData({ scores });
  },

  // 输入评价内容
  onCommentInput(e) {
    this.setData({
      comment: e.detail.value,
    });
  },

  loadGuestEvaluationData() {
    const isStaffTab = this.data.currentTab === 0;
    const mockCycle = {
      _id: "guest-cycle-1",
      title: isStaffTab
        ? "2026年第一季度服务人员绩效评价"
        : "2026年第一季度物业公司综合服务评价",
      deadline: "2026-04-15 23:59",
      startDate: "2026-03-15",
      endDate: "2026-04-15",
      hasEvaluated: false,
      dimensions: isStaffTab
        ? [{ name: "服务态度" }, { name: "响应及时性" }, { name: "处理专业度" }]
        : [
            { name: "保洁质量" },
            { name: "安保巡查" },
            { name: "客服响应" },
            { name: "设施维护" },
          ],
    };

    const dimensions = mockCycle.dimensions;
    const scores = {};
    dimensions.forEach((dim) => {
      scores[dim.name] = 0;
    });

    const guestStaff = {
      _id: "guest-staff-1",
      name: "张明",
      position: "客服管家",
      workScope: "3栋-5栋日常客服与工单协调",
      photo: "/images/avatar.png",
      hasEvaluated: false,
    };

    this.setData({
      cycles: [mockCycle],
      currentCycle: null,
      staffList: isStaffTab ? [guestStaff] : [],
      selectedStaff: null,
      dimensions,
      scores,
      comment: "整体服务较稳定，建议晚高峰时段增加客服在线值守。",
      isViewMode: false,
      evaluationHistory: [],
    });
  },

  // 格式化时间
  formatTime(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  // 检查是否可以提交
  canSubmit() {
    const { selectedStaff, scores, dimensions, currentTab } = this.data;

    // 服务人员评价需要选择人员，物业公司评价不需要
    if (currentTab === 0 && !selectedStaff) return false;

    // 检查所有维度是否都已评分
    for (let dim of dimensions) {
      if (!scores[dim.name] || scores[dim.name] === 0) {
        return false;
      }
    }

    return true;
  },

  // 提交评价
  async submitEvaluation() {
    if (this.data.isGuest) {
      if (!this.canSubmit()) {
        wx.showToast({
          title: "请完成所有评分",
          icon: "none",
        });
        return;
      }

      wx.showToast({
        title: "评价提交成功（演示）",
        icon: "success",
      });

      this.setData({
        isViewMode: true,
        evaluationHistory: [
          {
            _id: `guest-eval-${Date.now()}`,
            staff: this.data.selectedStaff
              ? {
                  name: this.data.selectedStaff.name,
                  position: this.data.selectedStaff.position,
                  photo: this.data.selectedStaff.photo,
                }
              : {
                  name: "星河苑物业服务中心",
                  position: "物业服务",
                  photo: "/images/avatar.png",
                },
            scores: { ...this.data.scores },
            comment: this.data.comment,
            createdAt: this.formatTime(new Date().toISOString()),
          },
        ],
      });
      return;
    }

    if (!this.canSubmit()) {
      wx.showToast({
        title: "请完成所有评分",
        icon: "none",
      });
      return;
    }

    if (this.data.loading) return;

    this.setData({ loading: true });
    wx.showLoading({ title: "提交中..." });

    try {
      // 根据当前tab调用不同的云函数
      const functionName =
        this.data.currentTab === 0
          ? "submitEvaluation" // 服务人员
          : "submitCompanyEvaluation"; // 物业公司

      const app = getApp();
      const data = {
        cycleId: this.data.currentCycle._id,
        scores: this.data.scores,
        comment: this.data.comment,
        communityId: app.globalData.communityId || "",
      };

      // 服务人员评价需要传staffId
      if (this.data.currentTab === 0) {
        data.staffId = this.data.selectedStaff._id;
      }

      const res = await wx.cloud.callFunction({
        name: functionName,
        data: data,
      });

      if (res.result.success) {
        wx.showToast({
          title: "评价提交成功",
          icon: "success",
        });

        // 延迟后重新加载数据并检查是否已完成所有评价
        setTimeout(async () => {
          // 重新加载周期列表以获取最新的评价状态
          try {
            const functionName =
              this.data.currentTab === 0
                ? "listEvaluationCycles"
                : "listCompanyEvaluationCycles";

            const cyclesRes = await wx.cloud.callFunction({
              name: functionName,
            });

            if (cyclesRes.result.success) {
              const cycles = cyclesRes.result.data;
              const currentCycle = cycles.find(
                (c) => c._id === this.data.currentCycle._id,
              );

              // 如果已完成所有评价，直接跳转到评价历史页
              if (currentCycle && currentCycle.hasEvaluated) {
                this.loadEvaluationHistory(currentCycle._id);
              } else {
                // 否则清空选择，重新加载数据
                if (this.data.currentTab === 0) {
                  // 服务人员：重新加载人员列表
                  this.setData({
                    selectedStaff: null,
                    scores: {},
                    comment: "",
                  });
                  this.loadStaffList(this.data.currentCycle._id);
                } else {
                  // 物业公司：直接返回周期列表
                  this.backToCyclesList();
                }
              }
            }
          } catch (error) {
            console.error("重新加载周期失败:", error);
            // 降级处理
            if (this.data.currentTab === 0) {
              // 服务人员：重新加载人员列表
              this.setData({
                selectedStaff: null,
                scores: {},
                comment: "",
              });
              this.loadStaffList(this.data.currentCycle._id);
            } else {
              // 物业公司：返回周期列表
              this.backToCyclesList();
            }
          }
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
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },
});
