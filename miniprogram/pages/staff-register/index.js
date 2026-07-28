Page({
  data: {
    name: "",
    phone: "",
    position: "",
    communityList: [],
    selectedCommunity: "",
    selectedCommunityId: "",
    submitting: false,
  },

  onLoad(options) {
    // 从上一页传来的小区信息
    const { communityId, communityName } = options;
    if (communityId && communityName) {
      this.setData({
        selectedCommunity: communityName,
        selectedCommunityId: communityId,
        communityList: [{ name: communityName, _id: communityId }],
      });
    } else {
      this.loadCommunities();
    }
  },

  async loadCommunities() {
    const app = getApp();
    try {
      const res = await wx.cloud.callFunction({
        name: "getUserCommunities",
        data: {},
      });
      if (res.result && res.result.success && res.result.data) {
        const communities = res.result.data.filter(
          (c) => c.status === "approved"
        );
        this.setData({ communityList: communities });
      }
    } catch (err) {
      console.error("加载小区列表失败:", err);
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPositionInput(e) {
    this.setData({ position: e.detail.value });
  },

  onCommunityChange(e) {
    const idx = e.detail.value;
    const community = this.data.communityList[idx];
    if (community) {
      this.setData({
        selectedCommunity: community.name,
        selectedCommunityId: community._id,
      });
    }
  },

  async onSubmit() {
    const { name, phone, position, selectedCommunityId } = this.data;

    // 校验
    if (!name.trim()) {
      wx.showToast({ title: "请输入姓名", icon: "none" });
      return;
    }
    if (!phone.trim()) {
      wx.showToast({ title: "请输入手机号", icon: "none" });
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      wx.showToast({ title: "手机号格式不正确", icon: "none" });
      return;
    }
    if (!selectedCommunityId) {
      wx.showToast({ title: "请选择小区", icon: "none" });
      return;
    }

    this.setData({ submitting: true });

    try {
      const res = await wx.cloud.callFunction({
        name: "staffRegister",
        data: {
          communityId: selectedCommunityId,
          name: name.trim(),
          phone: phone.trim(),
          position: position.trim(),
        },
      });

      if (res.result && res.result.success) {
        wx.showToast({ title: "提交成功，等待审核", icon: "success", duration: 2000 });
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      } else {
        wx.showToast({
          title: (res.result && res.result.error) || "提交失败",
          icon: "none",
        });
      }
    } catch (err) {
      console.error("staffRegister error:", err);
      wx.showToast({ title: "提交失败，请重试", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
