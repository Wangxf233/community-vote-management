Page({
  data: {
    plateChars: [],
    currentIndex: 0,
    queryResult: null,
    loading: false,
    provinces: ["鄂","京","津","沪","渝","冀","豫","云","辽","黑","湘","皖","鲁","苏","浙","赣","桂","甘","晋","蒙","陕","吉","闽","贵","粤","青","川","藏","宁","琼","新"],
    letters: ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"],
    numbers: ["1","2","3","4","5","6","7","8","9","0"],
    mixed: ["1","2","3","4","5","6","7","8","9","0","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"],
  },

  onShow() {
    // 隐藏左上角返回首页按钮
    wx.hideHomeButton();
    // 每次显示页面时实时验证工作人员身份
    this.verifyStaffStatus();
  },

  async verifyStaffStatus() {
    try {
      const res = await wx.cloud.callFunction({
        name: "getMyStaffStatus",
        data: {},
      });
      const isApproved = res.result && res.result.success && res.result.data && res.result.data.isApproved;
      if (!isApproved) {
        // 身份被撤销 → 清空标记 → 返回欢迎页
        const app = getApp();
        app.globalData.isStaff = false;
        app.globalData.staffInfo = null;
        wx.removeStorageSync("isStaffApproved");
        wx.reLaunch({ url: "/pages/welcome/index" });
      }
    } catch (err) {
      console.error("验证工作人员身份失败:", err);
    }
  },

  onProvince(e) {
    const v = e.currentTarget.dataset.v;
    if (!v) return;
    if (this.data.plateChars.length > 0) {
      const newChars = [v, ...this.data.plateChars.slice(1)];
      this.setData({ plateChars: newChars, currentIndex: Math.min(newChars.length, 8), queryResult: null });
      return;
    }
    this.setData({ plateChars: [v], currentIndex: 1, queryResult: null });
  },

  onLetter(e) {
    const v = e.currentTarget.dataset.v;
    if (!v) return;
    if (this.data.plateChars.length === 0) { wx.showToast({ title: "请先选择省份", icon: "none" }); return; }
    if (this.data.plateChars.length >= 8) { wx.showToast({ title: "最多输入8位", icon: "none" }); return; }
    const newChars = [...this.data.plateChars, v];
    this.setData({ plateChars: newChars, currentIndex: newChars.length, queryResult: null });
  },

  onMixed(e) {
    const v = e.currentTarget.dataset.v;
    if (!v) return;
    if (this.data.plateChars.length === 0) { wx.showToast({ title: "请先选择省份", icon: "none" }); return; }
    if (this.data.plateChars.length >= 8) { wx.showToast({ title: "最多输入8位", icon: "none" }); return; }
    const newChars = [...this.data.plateChars, v];
    this.setData({ plateChars: newChars, currentIndex: newChars.length, queryResult: null });
  },

  onDelete() {
    if (this.data.plateChars.length === 0) return;
    const newChars = this.data.plateChars.slice(0, -1);
    this.setData({ plateChars: newChars, currentIndex: newChars.length, queryResult: null });
  },

  onClear() {
    if (this.data.plateChars.length === 0) return;
    this.setData({ plateChars: [], currentIndex: 0, queryResult: null });
  },

  async onConfirm() {
    const plateNumber = this.data.plateChars.join("");
    if (!plateNumber) { wx.showToast({ title: "请输入车牌号", icon: "none" }); return; }

    this.setData({ loading: true, queryResult: null });

    try {
      const app = getApp();
      const res = await wx.cloud.callFunction({
        name: "staffQueryVehicle",
        data: { plateNumber, communityId: app.globalData.communityId || "" },
      });

      if (!res.result) throw new Error("查询失败");
      if (res.result.success && res.result.data) {
        this.setData({ queryResult: res.result.data });
      } else {
        wx.showToast({ title: res.result.error || "未找到该车辆信息", icon: "none" });
        this.setData({ queryResult: null });
      }
    } catch (err) {
      console.error("staffQueryVehicle error:", err);
      wx.showToast({ title: "查询失败，请重试", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  onCallOwner() {
    if (!this.data.queryResult || !this.data.queryResult.ownerPhone) {
      wx.showToast({ title: "暂无车主电话", icon: "none" });
      return;
    }
    wx.makePhoneCall({ phoneNumber: this.data.queryResult.ownerPhone });
  },
});
