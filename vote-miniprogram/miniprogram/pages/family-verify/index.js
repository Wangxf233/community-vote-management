Page({
  data: {
    step: 1,
    communityId: "",
    communityName: "",
    building: "",
    unit: "",
    room: "",
    phone: "",
    memberName: "",
    relationships: ["配偶", "子女", "父母", "兄弟姐妹", "其他"],
    relationshipIndex: null,
    submitting: false,
    applyTime: "",
    approveTime: "",
  },

  onLoad(options) {
    const { communityId, communityName, building, unit, room } = options;
    this.setData({
      communityId: communityId || "",
      communityName: communityName || "",
      building: building || "",
      unit: unit || "",
      room: room || "",
    });
  },

  // 获取手机号
  onGetPhoneNumber(e) {
    if (e.detail.errMsg !== "getPhoneNumber:ok") {
      wx.showToast({
        title: "需要手机号才能继续",
        icon: "none",
      });
      return;
    }

    wx.showLoading({ title: "获取中..." });
    wx.cloud
      .callFunction({
        name: "getPhoneNumber",
        data: { code: e.detail.code },
      })
      .then((res) => {
        wx.hideLoading();
        if (res.result && res.result.phoneNumber) {
          this.setData({ phone: res.result.phoneNumber });
        } else {
          wx.showToast({
            title: "获取手机号失败",
            icon: "none",
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({
          title: "获取失败: " + err.message,
          icon: "none",
        });
      });
  },

  // 输入姓名
  onMemberNameInput(e) {
    this.setData({ memberName: e.detail.value });
    this.checkCanSubmit();
  },

  // 选择关系
  onRelationshipChange(e) {
    this.setData({ relationshipIndex: parseInt(e.detail.value) });
    this.checkCanSubmit();
  },

  // 检查是否可以提交
  checkCanSubmit() {
    const { phone, memberName, relationshipIndex } = this.data;
    const canSubmit = phone && memberName.trim() && relationshipIndex !== null;
    this.setData({ canSubmit });
  },

  // 提交家属申请
  submitApplication() {
    const { phone, memberName, relationshipIndex, relationships } = this.data;

    if (!phone || !memberName.trim() || relationshipIndex === null) {
      wx.showToast({
        title: "请填写完整信息",
        icon: "none",
      });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: "提交中..." });

    const app = getApp();
    wx.cloud
      .callFunction({
        name: "familyManagement",
        data: {
          action: "apply",
          openid: app.globalData.openid,
          communityId: this.data.communityId,
          communityName: this.data.communityName,
          building: this.data.building,
          unit: this.data.unit,
          room: this.data.room,
          memberName: memberName.trim(),
          phone: phone,
          relationship: relationships[relationshipIndex],
        },
      })
      .then((res) => {
        wx.hideLoading();
        this.setData({ submitting: false });

        if (res.result && res.result.success) {
          const now = new Date();
          const timeStr = `${now.getFullYear()}-${String(
            now.getMonth() + 1
          ).padStart(2, "0")}-${String(now.getDate()).padStart(
            2,
            "0"
          )} ${String(now.getHours()).padStart(2, "0")}:${String(
            now.getMinutes()
          ).padStart(2, "0")}`;

          this.setData({
            step: 2,
            applyTime: timeStr,
          });
        } else {
          wx.showModal({
            title: "提交失败",
            content: res.result.error || "请稍后重试",
            showCancel: false,
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        wx.showModal({
          title: "提交失败",
          content: err.message,
          showCancel: false,
        });
      });
  },

  goHome() {
    wx.switchTab({
      url: "/pages/vote/index",
    });
  },
});
