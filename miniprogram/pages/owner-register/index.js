Page({
  data: {
    formData: {
      name: "",
      phone: "",
      communityName: "",
      propertyType: "house", // house 或 shop
      district: "",
      building: "",
      unit: "",
      room: "",
    },
    region: ["", "", ""],
    buildings: [],
    units: [],
    rooms: [],
    submitting: false,
    communityNotFound: false,
    isAdding: false, // 是否是添加新小区模式
  },

  checkCommunityTimer: null,

  onLoad(options) {
    // 检查是否是添加新小区模式
    if (options && options.isAdding === "true") {
      this.setData({ isAdding: true });
    }
  },

  onNameInput(e) {
    this.setData({
      "formData.name": e.detail.value,
    });
  },

  onPhoneInput(e) {
    this.setData({
      "formData.phone": e.detail.value,
    });
  },

  onPhoneBlur(e) {
    const phone = e.detail.value;
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: "手机号格式不正确",
        icon: "none",
        duration: 2000,
      });
    }
  },

  onRegionChange(e) {
    this.setData({
      region: e.detail.value,
    });

    // 如果已经输入了小区名称，则重新验证
    const communityName = this.data.formData.communityName.trim();
    if (communityName) {
      this.debouncedCheckCommunity();
    }
  },

  onCommunityInput(e) {
    const communityName = e.detail.value;
    this.setData({
      "formData.communityName": communityName,
    });

    // 使用防抖，800ms后自动校验
    if (communityName.trim()) {
      this.debouncedCheckCommunity();
    } else {
      // 清空输入时，清除定时器并重置状态
      if (this.checkCommunityTimer) {
        clearTimeout(this.checkCommunityTimer);
        this.checkCommunityTimer = null;
      }
      this.setData({
        communityNotFound: false,
        buildings: [],
        units: [],
        rooms: [],
        "formData.building": "",
        "formData.unit": "",
        "formData.room": "",
      });
    }
  },

  debouncedCheckCommunity() {
    // 清除之前的定时器
    if (this.checkCommunityTimer) {
      clearTimeout(this.checkCommunityTimer);
    }

    // 设置新的定时器，800ms后执行
    this.checkCommunityTimer = setTimeout(() => {
      const communityName = this.data.formData.communityName.trim();
      if (communityName) {
        this.checkCommunity(communityName);
      }
    }, 800);
  },

  onCommunityBlur(e) {
    // 失焦时不再验证，因为防抖机制已经处理了验证
    // 只需要清除可能存在的定时器，让验证立即执行
    if (this.checkCommunityTimer) {
      clearTimeout(this.checkCommunityTimer);
      this.checkCommunityTimer = null;

      const communityName = e.detail.value.trim();
      if (communityName) {
        this.checkCommunity(communityName);
      }
    }
  },

  async checkCommunity(communityName) {
    try {
      wx.showLoading({ title: "验证中...", mask: true });

      // 传递region参数以进行更精确的匹配
      const result = await wx.cloud.callFunction({
        name: "checkCommunity",
        data: {
          communityName,
          region: this.data.region, // 传递省市区信息
        },
      });

      wx.hideLoading();

      if (result.result && result.result.success) {
        // 小区存在，加载房屋配置
        this.setData({ communityNotFound: false });
        await this.loadHouseConfig(communityName);
      } else {
        // 小区不存在
        this.setData({
          communityNotFound: true,
          buildings: [],
          units: [],
          rooms: [],
          "formData.building": "",
          "formData.unit": "",
          "formData.room": "",
        });
        wx.showToast({
          title: "您的小区还未开通服务",
          icon: "none",
          duration: 2500,
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error("验证小区失败:", err);
      this.setData({
        communityNotFound: true,
        buildings: [],
        units: [],
        rooms: [],
      });
      wx.showToast({
        title: "验证小区失败，请重试",
        icon: "none",
      });
    }
  },

  onDistrictInput(e) {
    this.setData({
      "formData.district": e.detail.value,
    });
  },

  onPropertyTypeChange(e) {
    const propertyType = e.detail.value;
    this.setData({
      "formData.propertyType": propertyType,
      buildings: [],
      units: [],
      rooms: [],
      "formData.building": "",
      "formData.unit": "",
      "formData.room": "",
    });

    // 重新加载配置
    const communityName = this.data.formData.communityName.trim();
    if (communityName) {
      this.loadHouseConfig(communityName);
    }
  },

  async loadHouseConfig(communityName) {
    try {
      wx.showLoading({ title: "加载配置...", mask: true });

      const result = await wx.cloud.callFunction({
        name: "getHouseConfig",
        data: {
          communityName,
          type: this.data.formData.propertyType, // 传递类型
        },
      });

      wx.hideLoading();

      if (result.result && result.result.code === 0 && result.result.data) {
        const buildings = result.result.data.buildings || [];
        this.setData({ buildings });

        if (buildings.length === 0) {
          wx.showToast({
            title: "该小区暂无房屋配置",
            icon: "none",
            duration: 2000,
          });
        }
      } else {
        this.setData({ buildings: [] });
        wx.showToast({
          title: result.result?.message || "获取房屋配置失败",
          icon: "none",
          duration: 2000,
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error("获取房屋配置失败:", err);
      this.setData({ buildings: [] });
      wx.showToast({
        title: "获取房屋配置失败",
        icon: "none",
        duration: 2000,
      });
    }
  },

  onBuildingChange(e) {
    const index = e.detail.value;
    const building = this.data.buildings[index];

    this.setData({
      "formData.building": building.name,
      "formData.unit": "",
      "formData.room": "",
      units: building.units || [],
      rooms: [],
    });
  },

  onUnitChange(e) {
    const index = e.detail.value;
    const unit = this.data.units[index];

    this.setData({
      "formData.unit": unit.name,
      "formData.room": "",
      rooms: unit.rooms || [],
    });
  },

  onRoomChange(e) {
    const index = e.detail.value;
    const room = this.data.rooms[index];

    this.setData({
      "formData.room": room,
    });
  },

  validateForm() {
    const { name, phone, communityName, district, building, unit, room } =
      this.data.formData;

    if (!name) {
      wx.showToast({ title: "请输入姓名", icon: "none" });
      return false;
    }

    if (!phone) {
      wx.showToast({ title: "请输入手机号", icon: "none" });
      return false;
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: "手机号格式不正确", icon: "none" });
      return false;
    }

    if (!this.data.region[0]) {
      wx.showToast({ title: "请选择省市区", icon: "none" });
      return false;
    }

    if (!communityName) {
      wx.showToast({ title: "请输入小区名称", icon: "none" });
      return false;
    }

    if (!district) {
      wx.showToast({ title: "请输入区/期号", icon: "none" });
      return false;
    }

    if (!building || !unit || !room) {
      wx.showToast({ title: "请选择完整的房号信息", icon: "none" });
      return false;
    }

    return true;
  },

  async handleSubmit() {
    if (!this.validateForm()) {
      return;
    }

    this.setData({ submitting: true });

    try {
      const app = getApp();
      const openid = app.globalData.openid;

      if (!openid) {
        wx.showToast({ title: "请先登录", icon: "none" });
        this.setData({ submitting: false });
        return;
      }

      const result = await wx.cloud.callFunction({
        name: "submitCertification",
        data: {
          type: "owner",
          name: this.data.formData.name,
          phone: this.data.formData.phone,
          region: this.data.region,
          communityName: this.data.formData.communityName,
          district: this.data.formData.district,
          building: this.data.formData.building,
          unit: this.data.formData.unit,
          room: this.data.formData.room,
        },
      });

      if (result.result && result.result.code === 0) {
        app.globalData.bindingStatus = "pending";
        wx.setStorageSync("bindingStatus", "pending");

        const successMessage = this.data.isAdding
          ? "您的认证申请已提交，审核通常在24小时内完成，请耐心等待。审核通过后可在切换小区页面看到该小区。"
          : "您的认证申请已提交，审核通常在24小时内完成，请耐心等待";

        wx.showModal({
          title: "提交成功",
          content: successMessage,
          showCancel: false,
          success: () => {
            if (this.data.isAdding) {
              // 添加新小区模式，返回切换小区页面
              wx.navigateBack({
                delta: 1,
              });
            } else {
              // 首次注册模式，跳转到首页
              wx.switchTab({
                url: "/pages/service/index",
              });
            }
          },
        });
      } else {
        wx.showToast({
          title: result.result.message || "提交失败",
          icon: "none",
        });
      }
    } catch (err) {
      console.error("提交失败:", err);
      wx.showToast({
        title: "提交失败，请重试",
        icon: "none",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
