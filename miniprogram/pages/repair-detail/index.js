Page({
  data: {
    repairId: "",
    detail: {},
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({
        repairId: options.id,
      });
      this.loadDetail();
    } else {
      wx.showToast({
        title: "参数错误",
        icon: "none",
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载详情
  loadDetail: function () {
    const that = this;

    const bindingStatus = getApp().globalData.bindingStatus || "none";
    if (bindingStatus === "guest") {
      const map = {
        "guest-repair-1": {
          _id: "guest-repair-1",
          type: "repair",
          category: "电路维修",
          content: "2单元10层公共走廊照明间歇性闪烁，夜间影响通行。",
          status: "processing",
          submitTime: "2026-03-16 08:30",
          updatedAt: "2026-03-16 13:15",
          images: [
            "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=1200&q=80",
          ],
          processRemark: "工程人员已上门排查，预计今日晚间完成线路更换。",
        },
        "guest-repair-2": {
          _id: "guest-repair-2",
          type: "report",
          category: "环境卫生",
          content: "北门垃圾分类点异味较重，建议增加清运频次。",
          status: "completed",
          submitTime: "2026-03-12 14:20",
          updatedAt: "2026-03-13 09:40",
          images: [],
          processRemark: "已调整为每日两次清运，并增加除味处理。",
        },
      };

      const detail = map[this.data.repairId];
      if (!detail) {
        wx.showToast({ title: "记录不存在", icon: "none" });
        setTimeout(() => wx.navigateBack(), 1200);
        return;
      }

      detail.submitTimeFormatted = that.formatDateTime(detail.submitTime);
      detail.updatedAtFormatted = that.formatDateTime(detail.updatedAt);
      detail.statusText = that.getStatusText(detail.status);
      detail.statusClass = that.getStatusClass(detail.status);
      that.setData({ detail });
      return;
    }

    wx.showLoading({ title: "加载中..." });

    wx.cloud
      .callFunction({
        name: "getRepairDetail",
        data: {
          id: this.data.repairId,
        },
      })
      .then((res) => {
        wx.hideLoading();
        if (res.result && res.result.success && res.result.data) {
          const detail = res.result.data;

          // 格式化时间
          if (detail.submitTime) {
            detail.submitTimeFormatted = that.formatDateTime(detail.submitTime);
          }
          if (detail.updatedAt) {
            detail.updatedAtFormatted = that.formatDateTime(detail.updatedAt);
          }

          // 设置状态
          detail.statusText = that.getStatusText(detail.status);
          detail.statusClass = that.getStatusClass(detail.status);

          that.setData({ detail });
        } else {
          wx.showToast({
            title: res.result?.error || "记录不存在",
            icon: "none",
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("加载详情失败:", err);
        wx.showToast({
          title: "加载失败",
          icon: "none",
        });
      });
  },

  // 预览图片
  previewImage: function (e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.detail.images || [],
    });
  },

  // 撤销报修
  cancelRepair: function () {
    const that = this;
    const tipText = that.data.detail.type === "report" ? "报事" : "报修";

    const bindingStatus = getApp().globalData.bindingStatus || "none";
    if (bindingStatus === "guest") {
      wx.showToast({
        title: "游客模式为演示数据",
        icon: "none",
      });
      return;
    }

    wx.showModal({
      title: "提示",
      content: `确认撤销此${tipText}吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: "处理中..." });

          // 使用云函数更新
          wx.cloud
            .callFunction({
              name: "updateRepairStatus",
              data: {
                id: that.data.repairId,
                deleted: true,
              },
            })
            .then((result) => {
              wx.hideLoading();
              if (result.result && result.result.success) {
                wx.showToast({
                  title: "已撤销",
                  icon: "success",
                });
                setTimeout(() => {
                  wx.navigateBack();
                }, 1500);
              } else {
                wx.showToast({
                  title: result.result?.error || "操作失败",
                  icon: "none",
                });
              }
            })
            .catch((err) => {
              wx.hideLoading();
              console.error("撤销失败:", err);
              wx.showToast({
                title: "操作失败",
                icon: "none",
              });
            });
        }
      },
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
});
