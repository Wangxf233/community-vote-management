Page({
  data: {
    plateChars: [],
    currentIndex: 0,
    queryResult: null,
    loading: false,
    provinces: ["京","津","沪","渝","冀","豫","云","辽","黑","湘","皖","鲁","新","苏","浙","赣","鄂","桂","甘","晋","蒙","陕","吉","闽","贵","粤","青","川","藏","宁","琼"],
    letters: ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"],
    mixed: ["1","2","3","4","5","6","7","8","9","0","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"],
  },

  onShow() {
    // 检查工作人员状态
    this.checkStaffStatus();
  },

  async checkStaffStatus() {
    try {
      const res = await wx.cloud.callFunction({
        name: "getMyStaffStatus",
        data: {},
      });
      if (!res.result || !res.result.success || !res.result.data.isApproved) {
        wx.showModal({
          title: "无权限",
          content: "您不是审核通过的工作人员，无法使用车辆查询功能",
          showCancel: false,
          success: () => {
            wx.switchTab({ url: "/pages/service/index" });
          },
        });
      }
    } catch (err) {
      console.error("检查工作人员状态失败:", err);
    }
  },

  onProvince(e) {
    if (this.data.plateChars.length > 0) return;
    const v = e.currentTarget.dataset.v;
    this.setData({ plateChars: [v], currentIndex: 1 });
  },

  onLetter(e) {
    if (this.data.plateChars.length === 0) {
      wx.showToast({ title: "请先选择省份", icon: "none" });
      return;
    }
    if (this.data.plateChars.length >= 8) return;
    const v = e.currentTarget.dataset.v;
    const newChars = [...this.data.plateChars, v];
    this.setData({ plateChars: newChars, currentIndex: newChars.length });
  },

  onMixed(e) {
    if (this.data.plateChars.length === 0) {
      wx.showToast({ title: "请先选择省份", icon: "none" });
      return;
    }
    if (this.data.plateChars.length >= 8) return;
    const v = e.currentTarget.dataset.v;
    const newChars = [...this.data.plateChars, v];
    this.setData({ plateChars: newChars, currentIndex: newChars.length });
  },

  onDelete() {
    if (this.data.plateChars.length === 0) return;
    const newChars = this.data.plateChars.slice(0, -1);
    this.setData({
      plateChars: newChars,
      currentIndex: newChars.length,
      queryResult: null,
    });
  },

  onClear() {
    this.setData({
      plateChars: [],
      currentIndex: 0,
      queryResult: null,
    });
  },

  async onConfirm() {
    const plateNumber = this.data.plateChars.join("");
    if (!plateNumber) {
      wx.showToast({ title: "请输入车牌号", icon: "none" });
      return;
    }

    this.setData({ loading: true });

    try {
      const app = getApp();
      const res = await wx.cloud.callFunction({
        name: "staffQueryVehicle",
        data: {
          plateNumber,
          communityId: app.globalData.communityId || "",
        },
      });

      if (res.result && res.result.success) {
        this.setData({ queryResult: res.result.data });
      } else {
        wx.showToast({
          title: (res.result && res.result.error) || "未找到该车辆信息",
          icon: "none",
        });
        this.setData({ queryResult: null });
      }
    } catch (err) {
      console.error("staffQueryVehicle error:", err);
      wx.showToast({ title: "查询失败，请重试", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },
});
