Page({
  data: {
    communityId: "",
    communityName: "",
    building: "",
    unit: "",
    room: "",
  },

  onLoad(options) {
    // 从上一页传递的房屋信息
    const { communityId, communityName, building, unit, room } = options;
    this.setData({
      communityId: communityId || "",
      communityName: communityName || "",
      building: building || "",
      unit: unit || "",
      room: room || "",
    });
  },

  // 选择户主身份
  selectOwner() {
    wx.navigateTo({
      url: `/pages/owner-verify/index?communityId=${this.data.communityId}&communityName=${this.data.communityName}&building=${this.data.building}&unit=${this.data.unit}&room=${this.data.room}`,
    });
  },

  // 选择家属身份
  selectFamily() {
    wx.navigateTo({
      url: `/pages/family-verify/index?communityId=${this.data.communityId}&communityName=${this.data.communityName}&building=${this.data.building}&unit=${this.data.unit}&room=${this.data.room}`,
    });
  },

  // 选择工作人员身份
  selectStaff() {
    wx.navigateTo({
      url: `/pages/staff-register/index?communityId=${this.data.communityId}&communityName=${this.data.communityName}`,
    });
  },
});
