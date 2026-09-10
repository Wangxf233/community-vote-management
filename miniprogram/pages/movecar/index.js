Page({
  data: {
    plateChars: ["鄂", "H"], // 默认填充省份+字母，如 ["鄂","H","1","2","3","4","5"]
    currentIndex: 2,      // 当前输入位置（0~7），默认已填前两位
    queryResult: null,    // 查询结果
    loading: false,

    // 违停拍照上报
    violationPhoto: "",      // 已拍摄照片的本地临时路径
    violationUploaded: false, // 是否已上传成功
    violationUploading: false,

    // 省份列表（31个）
    provinces: [
      "鄂", "京", "津", "沪", "渝", "冀", "豫", "云",
      "辽", "黑", "湘", "皖", "鲁", "苏", "浙", "赣",
      "桂", "甘", "晋", "蒙", "陕", "吉", "闽", "贵",
      "粤", "青", "川", "藏", "宁", "琼", "新",
    ],

    // 字母列表（26个）
    letters: [
      "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
      "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
      "U", "V", "W", "X", "Y", "Z",
    ],

    // 数字列表
    numbers: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    // 混合列表（保留兼容）
    mixed: ["1","2","3","4","5","6","7","8","9","0","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"],
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
    const app = getApp();
    const plateNumber = this.data.plateChars.join("");

    if (!plateNumber) {
      wx.showToast({ title: "请输入车牌号", icon: "none" });
      return;
    }

    this.setData({
      loading: true,
      queryResult: null,
      violationPhoto: "",
      violationUploaded: false,
    });

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

  // ========== 违停拍照上报（可选，仅一张） ==========
  onTakeViolationPhoto() {
    if (this.data.violationUploaded) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["camera"],
      sizeType: ["compressed"],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        wx.showLoading({ title: "处理图片中..." });
        try {
          // 拍照后自动压缩到 512KB 以内
          const path = await this.compressImageTo512KB(
            file.tempFilePath,
            file.size || 0,
          );
          this.setData({ violationPhoto: path });
        } catch (err) {
          console.error("图片压缩失败，使用原图:", err);
          this.setData({ violationPhoto: file.tempFilePath });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  // 压缩图片到 512KB 以内（最多尝试3次，逐步降低质量；压缩失败时使用原图）
  compressImageTo512KB(src, size) {
    const MAX_SIZE = 512 * 1024;
    const getSize = (filePath) =>
      new Promise((resolve) => {
        wx.getFileSystemManager().getFileInfo({
          filePath,
          success: (info) => resolve(info.size || 0),
          fail: () => resolve(0),
        });
      });

    return new Promise(async (resolve) => {
      let path = src;
      let currentSize = size;
      let quality = 80;
      try {
        for (let i = 0; i < 3; i++) {
          if (currentSize > 0 && currentSize <= MAX_SIZE) break;
          const compRes = await wx.compressImage({ src: path, quality });
          path = compRes.tempFilePath;
          currentSize = await getSize(path);
          if (currentSize <= MAX_SIZE) break;
          quality = Math.max(10, quality - 25);
        }
        resolve(path);
      } catch (err) {
        resolve(src);
      }
    });
  },

  onRemoveViolationPhoto() {
    if (this.data.violationUploaded) return;
    this.setData({ violationPhoto: "" });
  },

  previewViolationPhoto() {
    if (this.data.violationPhoto) {
      wx.previewImage({ urls: [this.data.violationPhoto] });
    }
  },

  async onUploadViolation() {
    if (!this.data.violationPhoto) {
      wx.showToast({ title: "请先拍照", icon: "none" });
      return;
    }
    if (this.data.violationUploaded || this.data.violationUploading) return;

    const app = getApp();
    const plateNumber = this.data.queryResult
      ? this.data.queryResult.plateNumber
      : "";
    if (!plateNumber) {
      wx.showToast({ title: "未查询到车辆信息", icon: "none" });
      return;
    }

    this.setData({ violationUploading: true });
    wx.showLoading({ title: "上传中..." });

    try {
      // 上传照片到云存储（fileID 由云函数落库，读取时换取新链接避免过期）
      const extMatch = this.data.violationPhoto.match(/\.(\w+)$/);
      const ext = extMatch ? extMatch[1] : "jpg";
      const cloudPath = `parking-violations/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: this.data.violationPhoto,
      });

      const res = await wx.cloud.callFunction({
        name: "reportParkingViolation",
        data: {
          plateNumber,
          communityId: app.globalData.communityId || "",
          photoFileID: uploadRes.fileID,
        },
      });

      if (res.result && res.result.success) {
        this.setData({ violationUploaded: true });
        wx.showToast({
          title: "上传成功",
          icon: "none",
          duration: 2000,
        });
      } else {
        wx.showToast({
          title: (res.result && res.result.error) || "上传失败",
          icon: "none",
        });
      }
    } catch (err) {
      console.error("违停照片上传失败:", err);
      wx.showToast({ title: "上传失败，请重试", icon: "none" });
    } finally {
      this.setData({ violationUploading: false });
      wx.hideLoading();
    }
  },
});
