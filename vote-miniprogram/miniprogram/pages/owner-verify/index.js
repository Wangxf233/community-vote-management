Page({
  data: {
    step: 1,
    communityId: "",
    communityName: "",
    building: "",
    unit: "",
    room: "",
    phone: "",
    realName: "",
    idCardLast4: "",
    proofImages: [],
    submitting: false,
    submitTime: "",
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

  // 步骤1: 获取手机号
  onGetPhoneNumber(e) {
    if (e.detail.errMsg !== "getPhoneNumber:ok") {
      wx.showToast({
        title: "需要手机号才能继续",
        icon: "none",
      });
      return;
    }

    const code = e.detail.code;
    wx.showLoading({ title: "获取中..." });

    wx.cloud
      .callFunction({
        name: "getPhoneNumber",
        data: { code },
      })
      .then((res) => {
        wx.hideLoading();
        if (res.result && res.result.phoneNumber) {
          this.setData({
            phone: res.result.phoneNumber,
            step: 2,
          });
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

  // 步骤2: 实名认证
  doRealNameVerify() {
    wx.showLoading({ title: "认证中..." });

    wx.cloud
      .callFunction({
        name: "verifyRealName",
        data: {},
      })
      .then((res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          this.setData({
            realName: res.result.realName,
            idCardLast4: res.result.idCardLast4,
          });
          wx.showToast({
            title: "认证成功",
            icon: "success",
          });
        } else {
          wx.showModal({
            title: "认证失败",
            content: res.result.error || "请确保已完成微信实名认证",
            showCancel: false,
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showModal({
          title: "认证失败",
          content: err.message,
          showCancel: false,
        });
      });
  },

  // 步骤3: 选择图片
  chooseImage() {
    const remainCount = 6 - this.data.proofImages.length;
    wx.chooseImage({
      count: remainCount,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        this.uploadImages(tempFilePaths);
      },
    });
  },

  // 上传图片到云存储
  uploadImages(filePaths) {
    wx.showLoading({ title: "上传中..." });
    const uploadPromises = filePaths.map((filePath) => {
      const cloudPath = `proof-images/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.jpg`;
      return wx.cloud.uploadFile({
        cloudPath,
        filePath,
      });
    });

    Promise.all(uploadPromises)
      .then((results) => {
        wx.hideLoading();
        const fileIDs = results.map((r) => r.fileID);
        this.setData({
          proofImages: [...this.data.proofImages, ...fileIDs],
        });
        wx.showToast({
          title: "上传成功",
          icon: "success",
        });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({
          title: "上传失败: " + err.message,
          icon: "none",
        });
      });
  },

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.proofImages;
    images.splice(index, 1);
    this.setData({ proofImages: images });
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.proofImages,
    });
  },

  // 提交绑定申请
  submitBinding() {
    if (this.data.proofImages.length === 0) {
      wx.showToast({
        title: "请至少上传一张证明材料",
        icon: "none",
      });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: "提交中..." });

    const app = getApp();
    wx.cloud
      .callFunction({
        name: "submitBinding",
        data: {
          openid: app.globalData.openid,
          userType: "owner",
          phone: this.data.phone,
          realName: this.data.realName,
          idCardLast4: this.data.idCardLast4,
          communityId: this.data.communityId,
          communityName: this.data.communityName,
          building: this.data.building,
          unit: this.data.unit,
          room: this.data.room,
          proofImages: this.data.proofImages,
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
            step: 4,
            submitTime: timeStr,
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

  // 导航
  nextStep() {
    this.setData({ step: this.data.step + 1 });
  },

  prevStep() {
    this.setData({ step: this.data.step - 1 });
  },

  goHome() {
    wx.switchTab({
      url: "/pages/vote/index",
    });
  },
});
