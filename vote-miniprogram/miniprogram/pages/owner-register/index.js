Page({
  data: {
    formData: {
      name: "",
      phone: "",
      communityName: "",
      propertyType: "house",
      building: "",
      unit: "",
      room: "",
    },
    region: ["", "", ""],
    buildings: [],
    units: [],
    rooms: [],
    properties: [], // 已添加的房产列表
    submitting: false,
    communityNotFound: false,
    isAdding: false,
    communityList: [],
    showCommunityList: false,
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

    // 选择区域后加载该区域的小区列表
    if (e.detail.value[2]) {
      this.loadCommunitiesByRegion();
    }

    // 如果已经输入了小区名称，则重新验证
    const communityName = this.data.formData.communityName.trim();
    if (communityName) {
      this.debouncedCheckCommunity();
    }
  },

  // 加载指定区域的小区列表
  async loadCommunitiesByRegion() {
    try {
      let [province, city, district] = this.data.region;

      // 处理直辖市：如果city和province相同，说明是直辖市，将city改为"市辖区"
      const municipalities = ["北京市", "天津市", "上海市", "重庆市"];
      if (municipalities.includes(province) && city === province) {
        city = "市辖区";
      }

      const result = await wx.cloud.callFunction({
        name: "listCommunitiesByRegion",
        data: {
          province,
          city,
          district,
        },
      });

      if (result.result && result.result.code === 0) {
        this.setData({
          communityList: result.result.data || [],
        });
      } else {
        this.setData({ communityList: [] });
      }
    } catch (err) {
      console.error("加载小区列表失败:", err);
      this.setData({ communityList: [] });
    }
  },

  // 小区输入框获得焦点
  onCommunityFocus() {
    // 如果已选择了区域且有小区列表，则显示
    if (this.data.region[2]) {
      this.setData({ showCommunityList: true });
      // 如果还没有加载过小区列表，则加载
      if (this.data.communityList.length === 0) {
        this.loadCommunitiesByRegion();
      }
    } else {
      wx.showToast({
        title: "请先选择省市区",
        icon: "none",
      });
    }
  },

  // 选择小区
  onSelectCommunity(e) {
    const communityName = e.currentTarget.dataset.name;
    this.setData({
      "formData.communityName": communityName,
      showCommunityList: false,
    });
    // 选择后立即验证
    this.checkCommunity(communityName);
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

  onCommunityInputBlur() {
    // 延迟隐藏列表，给点击事件时间
    setTimeout(() => {
      this.setData({ showCommunityList: false });

      // 失焦时不再验证，因为防抖机制已经处理了验证
      // 只需要清除可能存在的定时器，让验证立即执行
      if (this.checkCommunityTimer) {
        clearTimeout(this.checkCommunityTimer);
        this.checkCommunityTimer = null;

        const communityName = this.data.formData.communityName.trim();
        if (communityName) {
          this.checkCommunity(communityName);
        }
      }
    }, 200);
  },

  async checkCommunity(communityName) {
    try {
      wx.showLoading({ title: "验证中...", mask: true });

      // 处理直辖市region数据
      let [province, city, district] = this.data.region;
      const municipalities = ["北京市", "天津市", "上海市", "重庆市"];
      if (municipalities.includes(province) && city === province) {
        city = "市辖区";
      }

      // 传递region参数以进行更精确的匹配
      const result = await wx.cloud.callFunction({
        name: "checkCommunity",
        data: {
          communityName,
          region: [province, city, district], // 传递处理后的省市区信息
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
    const { name, phone, building, unit, room } = this.data.formData;

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

    // 检查是否有已添加的房产或当前表单中有完整的房产信息
    const hasAddedProperties = this.data.properties.length > 0;
    const hasCurrentProperty = building && unit && room;

    if (!hasAddedProperties && !hasCurrentProperty) {
      wx.showToast({ title: "请至少填写一套房产信息", icon: "none" });
      return false;
    }

    return true;
  },

  // 添加房产到列表
  addProperty() {
    const { communityName, propertyType, building, unit, room } =
      this.data.formData;

    if (!communityName) {
      wx.showToast({ title: "请输入小区名称", icon: "none" });
      return;
    }

    if (this.data.communityNotFound) {
      wx.showToast({ title: "该小区还未开通服务", icon: "none" });
      return;
    }

    if (!building || !unit || !room) {
      wx.showToast({ title: "请选择完整的房号信息", icon: "none" });
      return;
    }

    // 检查是否已添加相同房产
    const duplicate = this.data.properties.some(
      (p) =>
        p.building === building &&
        p.unit === unit &&
        p.room === room &&
        p.propertyType === propertyType,
    );

    if (duplicate) {
      wx.showToast({ title: "该房产已添加", icon: "none" });
      return;
    }

    // 添加到列表
    const properties = this.data.properties.concat([
      {
        communityName,
        propertyType,
        building,
        unit,
        room,
      },
    ]);

    this.setData({
      properties,
      // 清空当前房产信息（保留小区和类型）
      "formData.building": "",
      "formData.unit": "",
      "formData.room": "",
      buildings: [],
      units: [],
      rooms: [],
    });

    wx.showToast({ title: "添加成功", icon: "success" });
  },

  // 删除房产
  deleteProperty(e) {
    const index = e.currentTarget.dataset.index;
    const properties = this.data.properties.filter((_, i) => i !== index);
    this.setData({ properties });
    wx.showToast({ title: "删除成功", icon: "success" });
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

      // 准备提交的房产列表
      let propertiesToSubmit = [...this.data.properties];

      // 如果当前表单中有房产信息，且还没有添加到列表，则自动添加
      const { communityName, propertyType, building, unit, room } =
        this.data.formData;
      if (building && unit && room) {
        // 检查是否已存在
        const exists = propertiesToSubmit.some(
          (p) =>
            p.building === building &&
            p.unit === unit &&
            p.room === room &&
            p.propertyType === propertyType,
        );

        if (!exists) {
          propertiesToSubmit.push({
            communityName,
            propertyType,
            building,
            unit,
            room,
          });
        }
      }

      const result = await wx.cloud.callFunction({
        name: "submitCertification",
        data: {
          type: "owner",
          name: this.data.formData.name,
          phone: this.data.formData.phone,
          region: this.data.region,
          properties: propertiesToSubmit,
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
