Page({
  data: {
    currentTab: 0, // 0: 新的报修, 1: 新的报事

    // 报修数据
    isUrgent: false, // 报修紧急状态
    equipment: "", // 设备名称
    location: "",
    description: "",
    images: [],
    video: "",
    canSubmit: false,

    // 报事数据
    isReportUrgent: false, // 报事紧急状态
    reportTitle: "",
    reportDescription: "",
    reportImages: [],
    reportVideo: "",
    canSubmitReport: false,

    // 进度数据
    repairProgress: [],
    reportProgress: [],
  },

  onLoad() {
    // 初始化页面
    this.loadProgressData();
  },

  onShow() {
    // 页面显示时刷新进度数据
    this.loadProgressData();
  },

  switchTab(e) {
    const tab = parseInt(e.currentTarget.dataset.tab);
    if (tab !== this.data.currentTab) {
      this.setData({
        currentTab: tab,
      });
    }
  },

  // 报修紧急状态切换
  onUrgencyChange(e) {
    const isUrgent = e.detail.value;
    this.setData({
      isUrgent: isUrgent,
    });
  },

  // 报事紧急状态切换
  onReportUrgencyChange(e) {
    const isReportUrgent = e.detail.value;
    this.setData({
      isReportUrgent: isReportUrgent,
    });
  },

  // 报修相关方法
  onEquipmentInput(e) {
    this.setData(
      {
        equipment: e.detail.value,
      },
      this.checkCanSubmit
    );
  },

  onLocationInput(e) {
    this.setData(
      {
        location: e.detail.value,
      },
      this.checkCanSubmit
    );
  },

  onDescriptionInput(e) {
    this.setData(
      {
        description: e.detail.value,
      },
      this.checkCanSubmit
    );
  },

  // 报事相关方法
  onReportTitleInput(e) {
    this.setData(
      {
        reportTitle: e.detail.value,
      },
      this.checkCanSubmitReport
    );
  },

  onReportDescriptionInput(e) {
    this.setData(
      {
        reportDescription: e.detail.value,
      },
      this.checkCanSubmitReport
    );
  },

  // 检查报修表单
  checkCanSubmit() {
    const { equipment, location, description } = this.data;
    this.setData({
      canSubmit: !!equipment && !!location && !!description,
    });
  },

  // 检查报事表单
  checkCanSubmitReport() {
    const { reportTitle, reportDescription } = this.data;
    this.setData({
      canSubmitReport: !!reportTitle && !!reportDescription,
    });
  },

  // 报修图片上传
  chooseImage() {
    wx.chooseMedia({
      count: 9 - this.data.images.length,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const newImages = res.tempFiles.map((file) => file.tempFilePath);
        this.setData({
          images: [...this.data.images, ...newImages],
        });
      },
      fail: (err) => {
        wx.showToast({
          title: "选择图片失败",
          icon: "none",
        });
      },
    });
  },

  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({ images });
  },

  // 报事图片上传
  chooseReportImage() {
    wx.chooseMedia({
      count: 9 - this.data.reportImages.length,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const newImages = res.tempFiles.map((file) => file.tempFilePath);
        this.setData({
          reportImages: [...this.data.reportImages, ...newImages],
        });
      },
      fail: (err) => {
        wx.showToast({
          title: "选择图片失败",
          icon: "none",
        });
      },
    });
  },

  deleteReportImage(e) {
    const index = e.currentTarget.dataset.index;
    const reportImages = [...this.data.reportImages];
    reportImages.splice(index, 1);
    this.setData({ reportImages });
  },

  // 报修视频上传
  chooseVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["video"],
      sourceType: ["album", "camera"],
      maxDuration: 30, // 最长30秒
      success: (res) => {
        this.setData({
          video: res.tempFiles[0].tempFilePath,
        });
      },
      fail: (err) => {
        wx.showToast({
          title: "选择视频失败",
          icon: "none",
        });
      },
    });
  },

  deleteVideo() {
    this.setData({ video: "" });
  },

  // 报事视频上传
  chooseReportVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["video"],
      sourceType: ["album", "camera"],
      maxDuration: 30, // 最长30秒
      success: (res) => {
        this.setData({
          reportVideo: res.tempFiles[0].tempFilePath,
        });
      },
      fail: (err) => {
        wx.showToast({
          title: "选择视频失败",
          icon: "none",
        });
      },
    });
  },

  deleteReportVideo() {
    this.setData({ reportVideo: "" });
  },

  // 提交报修
  async submitRepair() {
    if (!this.data.canSubmit) return;

    const app = getApp();
    const bindingInfo = app.globalData.bindingInfo;

    if (!bindingInfo || !bindingInfo.communityId) {
      wx.showToast({
        title: "请先绑定小区",
        icon: "none",
      });
      return;
    }

    wx.showLoading({
      title: "上报中...",
    });

    try {
      // 先上传文件（如果有）
      const fileUrls = await this.uploadFiles();

      // 准备提交数据
      const submitData = {
        communityId: bindingInfo.communityId,
        equipment: this.data.equipment,
        location: this.data.location,
        description: this.data.description,
        images: fileUrls.images || [],
        video: fileUrls.video || "",
        isUrgent: this.data.isUrgent,
        userId: bindingInfo._openid || bindingInfo._id || "",
        userName: bindingInfo.ownerName || bindingInfo.name || "未命名",
      };

      // 调用云函数提交报修
      const res = await wx.cloud.callFunction({
        name: "submitRepair",
        data: submitData,
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        wx.showToast({
          title: "报修提交成功",
          icon: "success",
          duration: 2000,
        });

        // 清空表单
        this.resetRepairForm();

        // 重新加载进度
        this.loadProgressData();
      } else {
        const errorMsg = res.result?.error || "提交失败";
        throw new Error(errorMsg);
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: err.message || err.errMsg || "提交失败",
        icon: "none",
        duration: 3000,
      });
    }
  },

  // 提交报事
  async submitReport() {
    if (!this.data.canSubmitReport) return;

    const app = getApp();
    const bindingInfo = app.globalData.bindingInfo;

    if (!bindingInfo || !bindingInfo.communityId) {
      wx.showToast({
        title: "请先绑定小区",
        icon: "none",
      });
      return;
    }

    wx.showLoading({
      title: "上报中...",
    });

    try {
      // 先上传文件（如果有）
      const fileUrls = await this.uploadReportFiles();

      // 准备提交数据
      const submitData = {
        communityId: bindingInfo.communityId,
        title: this.data.reportTitle,
        description: this.data.reportDescription,
        images: fileUrls.images || [],
        video: fileUrls.video || "",
        isUrgent: this.data.isReportUrgent,
        userId: bindingInfo._openid || bindingInfo._id || "",
        userName: bindingInfo.ownerName || bindingInfo.name || "未命名",
      };

      // 调用云函数提交报事
      const res = await wx.cloud.callFunction({
        name: "submitReport",
        data: submitData,
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        wx.showToast({
          title: "报事提交成功",
          icon: "success",
          duration: 2000,
        });

        // 清空表单
        this.resetReportForm();

        // 重新加载进度
        this.loadProgressData();
      } else {
        throw new Error(res.result?.error || "提交失败");
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: err.message || "提交失败",
        icon: "none",
      });
    }
  },

  // 上传报修文件
  async uploadFiles() {
    const fileIDs = [];
    const uploadedImages = [];

    // 上传图片
    for (let i = 0; i < this.data.images.length; i++) {
      try {
        const res = await wx.cloud.uploadFile({
          cloudPath: `repairs/images/${Date.now()}-${i}.${this.data.images[i]
            .split(".")
            .pop()}`,
          filePath: this.data.images[i],
        });
        // 直接使用 fileID 作为永久链接(需配置云存储为公开读)
        uploadedImages.push(res.fileID);
      } catch (err) {
        // 忽略上传失败的图片
      }
    }

    // 上传视频
    let uploadedVideo = "";
    if (this.data.video) {
      try {
        const res = await wx.cloud.uploadFile({
          cloudPath: `repairs/videos/${Date.now()}.${this.data.video
            .split(".")
            .pop()}`,
          filePath: this.data.video,
        });
        // 直接使用 fileID 作为永久链接(需配置云存储为公开读)
        uploadedVideo = res.fileID;
      } catch (err) {
        // 忽略上传失败的视频
      }
    }

    return { images: uploadedImages, video: uploadedVideo };
  },

  // 上传报事文件
  async uploadReportFiles() {
    const fileIDs = [];
    const uploadedImages = [];

    // 上传图片
    for (let i = 0; i < this.data.reportImages.length; i++) {
      try {
        const res = await wx.cloud.uploadFile({
          cloudPath: `reports/images/${Date.now()}-${i}.${this.data.reportImages[
            i
          ]
            .split(".")
            .pop()}`,
          filePath: this.data.reportImages[i],
        });
        // 直接使用 fileID 作为永久链接(需配置云存储为公开读)
        uploadedImages.push(res.fileID);
      } catch (err) {
        // 忽略上传失败的图片
      }
    }

    // 上传视频
    let uploadedVideo = "";
    if (this.data.reportVideo) {
      try {
        const res = await wx.cloud.uploadFile({
          cloudPath: `reports/videos/${Date.now()}.${this.data.reportVideo
            .split(".")
            .pop()}`,
          filePath: this.data.reportVideo,
        });
        // 直接使用 fileID 作为永久链接(需配置云存储为公开读)
        uploadedVideo = res.fileID;
      } catch (err) {
        // 忽略上传失败的视频
      }
    }

    return { images: uploadedImages, video: uploadedVideo };
  },

  // 重置报修表单
  resetRepairForm() {
    this.setData({
      isUrgent: false,
      equipment: "",
      location: "",
      description: "",
      images: [],
      video: "",
      canSubmit: false,
    });
  },

  // 重置报事表单
  resetReportForm() {
    this.setData({
      isReportUrgent: false,
      reportTitle: "",
      reportDescription: "",
      reportImages: [],
      reportVideo: "",
      canSubmitReport: false,
    });
  },

  // 加载进度数据
  async loadProgressData() {
    const app = getApp();
    const bindingInfo = app.globalData.bindingInfo;

    if (!bindingInfo || !bindingInfo.communityId) {
      return;
    }

    try {
      // 加载报修进度
      const repairRes = await wx.cloud.callFunction({
        name: "getRepairProgress",
        data: {
          communityId: bindingInfo.communityId,
          userId: bindingInfo._openid,
        },
      });

      // 加载报事进度
      const reportRes = await wx.cloud.callFunction({
        name: "getReportProgress",
        data: {
          communityId: bindingInfo.communityId,
          userId: bindingInfo._openid,
        },
      });

      const statusTextMap = {
        pending: "待处理",
        processing: "处理中",
        completed: "已完成",
      };

      const formatDate = (date) => {
        if (!date) return "";
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(d.getDate()).padStart(2, "0")} ${String(
          d.getHours()
        ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      };

      if (repairRes.result && repairRes.result.success) {
        const repairProgress = repairRes.result.data.map((item) => ({
          ...item,
          statusText: statusTextMap[item.status] || item.status,
          submitTime: formatDate(item.submitTime),
        }));
        this.setData({ repairProgress });
      }

      if (reportRes.result && reportRes.result.success) {
        const reportProgress = reportRes.result.data.map((item) => ({
          ...item,
          statusText: statusTextMap[item.status] || item.status,
          submitTime: formatDate(item.submitTime),
        }));
        this.setData({ reportProgress });
      }
    } catch (err) {
      // 忽略加载进度失败的错误
    }
  },

  onPullDownRefresh() {
    // 下拉刷新进度数据
    this.loadProgressData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },
});
