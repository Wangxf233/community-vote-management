const app = getApp();

Page({
  data: {
    formData: {
      inviteCode: "",
      name: "",
      phone: "",
      relation: "",
      relationIndex: -1,
    },
    relationOptions: ["配偶", "子女", "父母", "其他家庭成员"],
    isSubmitting: false,
    isAdding: false, // 是否是添加新小区模式
  },

  onLoad(options) {
    // 检查是否是添加新小区模式
    if (options && options.isAdding === "true") {
      this.setData({ isAdding: true });
    }

    // 从分享链接自动填充邀请码
    if (options && options.inviteCode) {
      this.setData({ "formData.inviteCode": decodeURIComponent(options.inviteCode) });
    }

    // 从小程序码 scene 参数填充邀请码
    if (options && options.scene) {
      const scene = decodeURIComponent(options.scene);
      if (scene.startsWith("inviteCode=")) {
        this.setData({ "formData.inviteCode": scene.replace("inviteCode=", "") });
      }
    }
  },

  /**
   * 输入框内容变化
   */
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`formData.${field}`]: value,
    });
  },

  /**
   * 关系选择变化
   */
  onRelationChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      "formData.relationIndex": index,
      "formData.relation": this.data.relationOptions[index],
    });
  },

  /**
   * 验证表单
   */
  validateForm() {
    const { inviteCode, name, phone } = this.data.formData;

    if (!inviteCode || inviteCode.trim() === "") {
      wx.showToast({
        title: "请输入邀请码",
        icon: "none",
      });
      return false;
    }

    if (!name || name.trim() === "") {
      wx.showToast({
        title: "请输入姓名",
        icon: "none",
      });
      return false;
    }

    if (!phone || phone.trim() === "") {
      wx.showToast({
        title: "请输入手机号",
        icon: "none",
      });
      return false;
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      wx.showToast({
        title: "手机号格式不正确",
        icon: "none",
      });
      return false;
    }

    return true;
  },

  /**
   * 提交注册
   */
  async handleSubmit() {
    if (!this.validateForm()) {
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      const result = await wx.cloud.callFunction({
        name: "submitCertification",
        data: {
          type: "family",
          inviteCode: this.data.formData.inviteCode.trim(),
          name: this.data.formData.name.trim(),
          phone: this.data.formData.phone.trim(),
          relation: this.data.formData.relation || "其他家庭成员",
        },
      });

      if (result.result && result.result.code === 0) {
        // 家属注册自动通过，更新全局状态
        app.globalData.bindingStatus = "approved";
        wx.setStorageSync("bindingStatus", "approved");
        if (result.result.data && result.result.data.communityId) {
          app.globalData.communityId = result.result.data.communityId;
          wx.setStorageSync("communityId", result.result.data.communityId);
        }

        wx.showModal({
          title: "注册成功",
          content: "欢迎您，您已成功加入家庭！",
          showCancel: false,
          success: () => {
            if (this.data.isAdding) {
              wx.navigateBack({ delta: 1 });
            } else {
              wx.reLaunch({ url: "/pages/service/index" });
            }
          },
        });
      } else {
        throw new Error(result.result.message || "提交失败");
      }
    } catch (error) {
      console.error("提交家属注册失败:", error);
      let errorMsg = "提交失败，请稍后重试";

      if (error.message) {
        if (error.message.includes("邀请码")) {
          errorMsg = "邀请码无效或已过期";
        } else if (error.message.includes("已注册")) {
          errorMsg = "该手机号已注册";
        } else {
          errorMsg = error.message;
        }
      }

      wx.showToast({
        title: errorMsg,
        icon: "none",
        duration: 2000,
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },
});
