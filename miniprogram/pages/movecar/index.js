Page({
  data: {
    plateChars: [],       // 已选字符数组，如 ["鄂","A","1","2","3","4","5"]
    currentIndex: 0,      // 当前输入位置（0~7）
    queryResult: null,    // 查询结果
    loading: false,

    // 省份列表（31个）
    provinces: [
      "京", "津", "沪", "渝", "冀", "豫", "云", "辽",
      "黑", "湘", "皖", "鲁", "新", "苏", "浙", "赣",
      "鄂", "桂", "甘", "晋", "蒙", "陕", "吉", "闽",
      "贵", "粤", "青", "川", "藏", "宁", "琼",
    ],

    // 字母列表（26个）
    letters: [
      "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
      "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
      "U", "V", "W", "X", "Y", "Z",
    ],

    // 混合列表（数字 + 字母，共36个）
    mixed: [
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
      "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
      "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
      "U", "V", "W", "X", "Y", "Z",
    ],
  },

  onLoad() {},

  onShow() {
    const app = getApp();
    // 工作人员已导向独立页面
    if (app.globalData.isStaff) {
      wx.reLaunch({ url: "/pages/staff-movecar/index" });
      return;
    }
    // 游客模式：不弹窗
    const status = app.globalData.bindingStatus;
    if (status === "guest") return;
    // 非游客：需要认证
    app.requirePermission("使用挪车功能");
  },

  // ========== 省份选择（仅第一位可选省份） ==========
  onProvince(e) {
    const v = e.currentTarget.dataset.v;
    if (!v) return;

    // 省份只能是第一位，如果已有字符则替换第一位
    if (this.data.plateChars.length > 0) {
      const newChars = [v, ...this.data.plateChars.slice(1)];
      this.setData({
        plateChars: newChars,
        currentIndex: Math.min(newChars.length, 8),
        queryResult: null,
      });
      return;
    }

    this.setData({
      plateChars: [v],
      currentIndex: 1,
      queryResult: null,
    });
  },

  // ========== 字母选择 ==========
  onLetter(e) {
    const v = e.currentTarget.dataset.v;
    if (!v) return;

    if (this.data.plateChars.length === 0) {
      wx.showToast({ title: "请先选择省份", icon: "none" });
      return;
    }

    if (this.data.plateChars.length >= 8) {
      wx.showToast({ title: "最多输入8位", icon: "none" });
      return;
    }

    const newChars = [...this.data.plateChars, v];
    this.setData({
      plateChars: newChars,
      currentIndex: newChars.length,
      queryResult: null,
    });
  },

  // ========== 混合选择（数字+字母，任何位置都可用除了第一位） ==========
  onMixed(e) {
    const v = e.currentTarget.dataset.v;
    if (!v) return;

    if (this.data.plateChars.length === 0) {
      wx.showToast({ title: "请先选择省份", icon: "none" });
      return;
    }

    if (this.data.plateChars.length >= 8) {
      wx.showToast({ title: "最多输入8位", icon: "none" });
      return;
    }

    const newChars = [...this.data.plateChars, v];
    this.setData({
      plateChars: newChars,
      currentIndex: newChars.length,
      queryResult: null,
    });
  },

  // ========== 退格删除 ==========
  onDelete() {
    if (this.data.plateChars.length === 0) return;

    const newChars = this.data.plateChars.slice(0, -1);
    this.setData({
      plateChars: newChars,
      currentIndex: newChars.length,
      queryResult: null,
    });
  },

  // ========== 清空全部 ==========
  onClear() {
    if (this.data.plateChars.length === 0) return;

    this.setData({
      plateChars: [],
      currentIndex: 0,
      queryResult: null,
    });
  },

  // ========== 确认查询 ==========
  async onConfirm() {
    const plateNumber = this.data.plateChars.join("");

    if (!plateNumber) {
      wx.showToast({ title: "请输入车牌号", icon: "none" });
      return;
    }

    this.setData({ loading: true, queryResult: null });

    try {
      const res = await wx.cloud.callFunction({
        name: "movecarQuery",
        data: {
          plateNumber,
          communityId: app.globalData.communityId || "",
        },
      });

      if (!res.result) {
        throw new Error("查询失败，请重试");
      }

      if (res.result.success) {
        if (res.result.data) {
          this.setData({ queryResult: res.result.data });
        } else {
          wx.showToast({ title: "未找到该车辆信息", icon: "none" });
          this.setData({ queryResult: null });
        }
      } else {
        wx.showToast({
          title: res.result.error || "未找到该车辆信息",
          icon: "none",
        });
        this.setData({ queryResult: null });
      }
    } catch (err) {
      console.error("movecarQuery error:", err);
      wx.showModal({
        title: "查询失败",
        content: "网络异常，请检查网络后重试",
        showCancel: true,
        confirmText: "重试",
        cancelText: "取消",
        success: (modalRes) => {
          if (modalRes.confirm) {
            this.onConfirm();
          }
        },
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // ========== 联系车主 — 明文拨号 ==========
  onCallOwner() {
    if (!this.data.queryResult) {
      wx.showToast({ title: "暂无查询结果", icon: "none" });
      return;
    }

    if (!this.data.queryResult.ownerPhone) {
      wx.showToast({ title: "暂无车主电话", icon: "none" });
      return;
    }

    wx.makePhoneCall({
      phoneNumber: this.data.queryResult.ownerPhone,
      fail: () => {
        wx.showToast({ title: "拨号失败", icon: "none" });
      },
    });
  },
});
