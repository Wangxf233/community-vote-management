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
