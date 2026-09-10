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
      houseNumber: "",
      shopName: "",
    },
    region: ["", "", ""],
    buildings: [],
    units: [],
    rooms: [],
    houseNumbers: [], // 商铺配置：门牌号列表（后台无配置时为空，下拉框置灰）
    shopNames: [], // 商铺配置：商铺名列表（后台无配置时为空，下拉框置灰）
    shopPairs: [], // 商铺配置：门牌号+商铺名成对数据，用于选择时自动关联
    properties: [], // 已添加的房产列表
    submitting: false,
    communityNotFound: false,
    isAdding: false,
    addRole: false, // 增加角色模式（同一小区添加户主/商铺第二个角色）
    communityList: [],
    showCommunityList: false,
  },

  checkCommunityTimer: null,

  onLoad(options) {
    // 检查是否是添加新小区模式
    if (options && options.isAdding === "true") {
      this.setData({ isAdding: true });
    }

    // 检查是否是增加角色模式（切换小区页"增加角色"入口）
    if (options && options.addRole === "true") {
      this.setData({ addRole: true });
    }

    // 增加角色模式：携带当前小区信息（切换小区页"增加角色"入口），自动预填并校验小区
    if (options && options.communityName) {
      const communityName = decodeURIComponent(options.communityName);
      let region = ["", "", ""];
      if (options.region) {
        const parts = decodeURIComponent(options.region).split(",");
        if (parts.length === 3) {
          region = parts;
        }
      }
      this.setData({
        "formData.communityName": communityName,
        region,
      });
      // 省市区信息完整时自动校验小区并加载房屋/商铺配置
      if (communityName && region[0] && region[2]) {
        this.checkCommunity(communityName);
      }
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

  // 选择小区（picker 模式）
  onSelectCommunity(e) {
    const index = e.detail.value;
    const item = this.data.communityList[index];
    if (!item) return;
    const communityName = item.name;
    this.setData({
      "formData.communityName": communityName,
    });
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
        houseNumbers: [],
        shopNames: [],
        shopPairs: [],
        "formData.building": "",
        "formData.unit": "",
        "formData.room": "",
        "formData.houseNumber": "",
        "formData.shopName": "",
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
          houseNumbers: [],
          shopNames: [],
          shopPairs: [],
          "formData.building": "",
          "formData.unit": "",
          "formData.room": "",
          "formData.houseNumber": "",
          "formData.shopName": "",
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
        houseNumbers: [],
        shopNames: [],
        shopPairs: [],
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
      houseNumbers: [],
      shopNames: [],
      shopPairs: [],
      "formData.building": "",
      "formData.unit": "",
      "formData.room": "",
      "formData.houseNumber": "",
      "formData.shopName": "",
      // 房屋/商铺数据结构不同（building/unit/room vs houseNumber/shopName），
      // 切换类型时清空已添加列表，避免混合类型数据提交被后端拒绝
      properties: [],
    });

    // 重新加载配置（房屋加载楼栋/单元/房号，商铺加载门牌号/商铺名）
    const communityName = this.data.formData.communityName.trim();
    if (communityName) {
      this.loadHouseConfig(communityName);
    }
  },

  async loadHouseConfig(communityName) {
    try {
      wx.showLoading({ title: "加载配置...", mask: true });

      // 商铺角色：加载商铺配置（门牌号、商铺名两个下拉），与房屋配置完全隔离
      if (this.data.formData.propertyType === "shop") {
        const result = await wx.cloud.callFunction({
          name: "getShopConfig",
          data: {
            communityName,
          },
        });

        wx.hideLoading();

        if (result.result && result.result.code === 0 && result.result.data) {
          const houseNumbers = result.result.data.houseNumbers || [];
          const shopNames = result.result.data.shopNames || [];

          // 成对配置（门牌号+商铺名一一对应），用于选择时自动关联
          let shopPairs = result.result.data.shops || [];
          if (
            shopPairs.length === 0 &&
            (houseNumbers.length > 0 || shopNames.length > 0)
          ) {
            // 兼容：云端未返回成对数据时，按下标一一配对
            const maxLen = Math.max(houseNumbers.length, shopNames.length);
            for (let i = 0; i < maxLen; i++) {
              shopPairs.push({
                houseNumber: houseNumbers[i] || "",
                shopName: shopNames[i] || "",
              });
            }
          }

          this.setData({ houseNumbers, shopNames, shopPairs });

          // 后台未配置时对应下拉框置灰禁用（picker disabled），此处仅提示
          if (houseNumbers.length === 0 && shopNames.length === 0) {
            wx.showToast({
              title: "该小区暂未配置商铺信息",
              icon: "none",
              duration: 2000,
            });
          }
        } else {
          this.setData({ houseNumbers: [], shopNames: [] });
          wx.showToast({
            title: result.result?.message || "获取商铺配置失败",
            icon: "none",
            duration: 2000,
          });
        }
        return;
      }

      // 房屋角色：原有逻辑
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

  // 商铺门牌号选择（门牌号与商铺名都配置时，自动关联商铺名）
  onHouseNumberChange(e) {
    const index = e.detail.value;
    const houseNumber = this.data.houseNumbers[index];
    const updates = { "formData.houseNumber": houseNumber };

    // 门牌号、商铺名都配置了才做自动关联；只配置一项时直接选择即可
    if (
      this.data.houseNumbers.length > 0 &&
      this.data.shopNames.length > 0
    ) {
      const pair = this.data.shopPairs.find(
        (p) => p.houseNumber === houseNumber,
      );
      updates["formData.shopName"] = pair && pair.shopName ? pair.shopName : "";
    }

    this.setData(updates);
  },

  // 商铺名选择（门牌号与商铺名都配置时，自动关联门牌号）
  onShopNameChange(e) {
    const index = e.detail.value;
    const shopName = this.data.shopNames[index];
    const updates = { "formData.shopName": shopName };

    if (
      this.data.houseNumbers.length > 0 &&
      this.data.shopNames.length > 0
    ) {
      const pair = this.data.shopPairs.find((p) => p.shopName === shopName);
      updates["formData.houseNumber"] =
        pair && pair.houseNumber ? pair.houseNumber : "";
    }

    this.setData(updates);
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
    const { name, phone, building, unit, room, propertyType, houseNumber, shopName } =
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

    // 商铺校验：后台配置了对应数据时必选；未配置的下拉框已置灰不可选。
    // 已添加过商铺列表时不再强制要求当前表单重选（addProperty 清空了当前选择）。
    if (propertyType === "shop") {
      const hasAddedProperties = this.data.properties.length > 0;
      if (!hasAddedProperties) {
        if (
          this.data.houseNumbers.length === 0 &&
          this.data.shopNames.length === 0
        ) {
          wx.showToast({ title: "该小区暂未配置商铺信息，请联系物业", icon: "none" });
          return false;
        }
        if (this.data.houseNumbers.length > 0 && !houseNumber) {
          wx.showToast({ title: "请选择门牌号", icon: "none" });
          return false;
        }
        if (this.data.shopNames.length > 0 && !shopName) {
          wx.showToast({ title: "请选择商铺名", icon: "none" });
          return false;
        }
        if (!houseNumber && !shopName) {
          wx.showToast({ title: "请至少填写一套商铺信息", icon: "none" });
          return false;
        }
      }
      return true;
    }

    // 房屋原有校验：检查是否有已添加的房产或当前表单中有完整的房产信息
    const hasAddedProperties = this.data.properties.length > 0;
    const hasCurrentProperty = building && unit && room;

    if (!hasAddedProperties && !hasCurrentProperty) {
      wx.showToast({ title: "请至少填写一套房产信息", icon: "none" });
      return false;
    }

    return true;
  },

  // 添加房产/商铺到列表
  addProperty() {
    const { communityName, propertyType, building, unit, room, houseNumber, shopName } =
      this.data.formData;

    if (!communityName) {
      wx.showToast({ title: "请输入小区名称", icon: "none" });
      return;
    }

    if (this.data.communityNotFound) {
      wx.showToast({ title: "该小区还未开通服务", icon: "none" });
      return;
    }

    // 商铺：后台配置了对应数据时必选；未配置的下拉框已置灰不可选
    if (propertyType === "shop") {
      if (
        this.data.houseNumbers.length === 0 &&
        this.data.shopNames.length === 0
      ) {
        wx.showToast({ title: "该小区暂未配置商铺信息，请联系物业", icon: "none" });
        return;
      }
      if (this.data.houseNumbers.length > 0 && !houseNumber) {
        wx.showToast({ title: "请选择门牌号", icon: "none" });
        return;
      }
      if (this.data.shopNames.length > 0 && !shopName) {
        wx.showToast({ title: "请选择商铺名", icon: "none" });
        return;
      }

      // 检查是否已添加相同商铺
      const duplicate = this.data.properties.some(
        (p) =>
          p.propertyType === "shop" &&
          p.houseNumber === houseNumber &&
          p.shopName === shopName,
      );

      if (duplicate) {
        wx.showToast({ title: "该商铺已添加", icon: "none" });
        return;
      }

      // 添加到列表
      const properties = this.data.properties.concat([
        {
          communityName,
          propertyType,
          houseNumber,
          shopName,
        },
      ]);

      this.setData({
        properties,
        // 清空当前商铺信息（保留小区、类型和下拉配置，便于继续选择）
        "formData.houseNumber": "",
        "formData.shopName": "",
      });

      wx.showToast({ title: "添加成功", icon: "success" });
      return;
    }

    // 房屋原有逻辑
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

      // 准备提交的房产/商铺列表
      let propertiesToSubmit = [...this.data.properties];

      const { communityName, propertyType, building, unit, room, houseNumber, shopName } =
        this.data.formData;

      if (propertyType === "shop") {
        // 商铺：当前表单中有商铺信息且未添加，则自动添加
        if (houseNumber || shopName) {
          const exists = propertiesToSubmit.some(
            (p) =>
              p.propertyType === "shop" &&
              p.houseNumber === houseNumber &&
              p.shopName === shopName,
          );

          if (!exists) {
            propertiesToSubmit.push({
              communityName,
              propertyType,
              houseNumber,
              shopName,
            });
          }
        }
      } else {
        // 房屋原有逻辑：当前表单中有房产信息且未添加，则自动添加
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
      }

      const result = await wx.cloud.callFunction({
        name: "submitCertification",
        data: {
          type: propertyType === "shop" ? "shop" : "owner",
          name: this.data.formData.name,
          phone: this.data.formData.phone,
          region: this.data.region,
          properties: propertiesToSubmit,
        },
      });

      if (result.result && result.result.code === 0) {
        app.globalData.bindingStatus = "pending";
        wx.setStorageSync("bindingStatus", "pending");

        const successMessage = this.data.addRole
          ? "您的角色认证申请已提交，审核通常在24小时内完成，请耐心等待。审核通过后即可使用该角色的功能。"
          : this.data.isAdding
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
