const { formatRoom } = require("../../utils/formatRoom.js");

Page({
  data: {
    // 三步流程：1=获取手机号, 2=填写信息, 3=提交成功
    currentStep: 1,

    // Step 1: 手机号
    phone: "",

    // Step 2: form
    name: "",
    region: [],
    regionDisplay: "",
    communityName: "",
    communityChecked: null,
    building: "",
    block: "",
    room: "",
    residentialArea: "", // 住宅面积
    commercialArea: "", // 商业面积
    parkingArea: "", // 车位面积
    carNumber: "", // 车牌号

    // binding status: none | pending | approved | rejected
    bindingStatus: "none",
    rejectReason: "",

    // candidates from checkCommunity
    candidates: [],
    showCandidates: false,
    dropdownActive: false,
  },

  onLoad(options) {
    // 检查是否已有绑定信息
    this.fetchExistingBinding();
  },

  fetchExistingBinding() {
    const that = this;
    const app = getApp();

    wx.cloud.callFunction({
      name: "getBindingInfo",
      data: { openid: app.globalData.openid },
      success(res) {
        if (res.result && res.result.success) {
          const binding = res.result.binding;

          if (binding) {
            // 已有绑定记录，显示状态或允许修改
            that.setData({
              bindingStatus: binding.status,
              phone: binding.phone || "",
              name: binding.name || "",
              region: binding.region || [],
              regionDisplay: binding.region ? binding.region.join(" / ") : "",
              communityName: binding.communityName || "",
              building: binding.building || "",
              block: binding.block || "",
              room: binding.room || "",
              residentialArea: binding.residentialArea || "",
              commercialArea: binding.commercialArea || "",
              parkingArea: binding.parkingArea || "",
              carNumber: binding.carNumber || "",
              rejectReason: binding.rejectReason || "",
            });

            // 根据状态决定显示哪一步
            if (binding.status === "pending") {
              that.setData({ currentStep: 3 });
            } else if (binding.status === "rejected") {
              that.setData({ currentStep: 2 }); // 允许重新填写
            } else if (binding.status === "approved") {
              // 已通过，跳转回首页
              wx.showToast({
                title: "您已完成绑定",
                icon: "success",
              });
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            }
          } else {
            // 无记录，从第一步开始
            that.setData({ currentStep: 1 });
          }
        }
      },
      fail() {
        // 出错，从第一步开始
        that.setData({ currentStep: 1 });
      },
    });
  },

  // Step 1: 获取手机号
  getPhoneNumber(e) {
    if (e.detail.errMsg === "getPhoneNumber:ok") {
      const code = e.detail.code;

      // 调用云函数获取手机号
      wx.cloud.callFunction({
        name: "getPhoneNumber",
        data: { code },
        success: (res) => {
          if (res.result && res.result.phoneNumber) {
            this.setData({
              phone: res.result.phoneNumber,
              currentStep: 2,
            });
          } else {
            wx.showToast({
              title: "获取手机号失败",
              icon: "none",
            });
          }
        },
        fail: () => {
          wx.showToast({
            title: "获取手机号失败",
            icon: "none",
          });
        },
      });
    } else {
      wx.showToast({
        title: "需要手机号才能继续",
        icon: "none",
      });
    }
  },

  // 跳过手机号（暂不支持，可以注释掉或保留）
  skipPhone() {
    wx.showModal({
      title: "提示",
      content: "绑定需要提供手机号用于身份验证",
      showCancel: false,
    });
  },

  // Step 2: 表单输入
  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onRegionChange(e) {
    const region = e.detail.value;
    this.setData({ region, regionDisplay: region.join(" / ") });
  },

  onCommunityInput(e) {
    const val = e.detail.value;
    this.setData({ communityName: val, communityChecked: null });
    if (val) {
      this.checkCommunityExist(val);
    }
  },

  onBuildingInput(e) {
    this.setData({ building: e.detail.value });
  },

  onBlockInput(e) {
    this.setData({ block: e.detail.value });
  },

  onRoomInput(e) {
    const room = e.detail.value;
    // 格式化房号为4位数
    const formattedRoom = formatRoom(room);
    this.setData({ room: formattedRoom });
  },

  onResidentialAreaInput(e) {
    this.setData({ residentialArea: e.detail.value });
  },

  onCommercialAreaInput(e) {
    this.setData({ commercialArea: e.detail.value });
  },

  onParkingAreaInput(e) {
    this.setData({ parkingArea: e.detail.value });
  },

  onCarNumberInput(e) {
    this.setData({ carNumber: e.detail.value });
  },

  onChooseLocation() {
    const that = this;
    // 使用 chooseLocation 让用户选位置（包含名称），若权限被拒则引导
    wx.chooseLocation({
      success(res) {
        // res.name 是地点名称，可填充为小区名
        that.setData(
          { communityName: res.name, communityChecked: null },
          () => {
            that.checkCommunityExist(res.name);
            that.checkCanSubmit();
          }
        );
      },
      fail(err) {
        // 如果用户拒绝定位权限，提示并引导打开设置
        wx.showModal({
          title: "需要定位权限",
          content: "请开启定位权限以使用定位功能",
          confirmText: "去设置",
          success(r) {
            if (r.confirm) {
              wx.openSetting({});
            }
          },
        });
      },
    });
  },

  checkCommunityExist(name) {
    if (!name) return;
    const that = this;
    wx.cloud.callFunction({
      name: "checkCommunity",
      data: { name },
      success(res) {
        // New checkCommunity returns { exists, exactMatch, candidates, matchedCount }
        const result = res && res.result ? res.result : {};
        const exact = !!result.exactMatch || !!result.exists;
        // populate candidates for user selection if available
        let candidates = Array.isArray(result.candidates)
          ? result.candidates
          : [];
        // if exactMatch exists and no candidates returned, include exact at top so user can see/confirm
        if (result.exactMatch && (!candidates || candidates.length === 0)) {
          candidates = [result.exactMatch];
        }
        // show candidates if any (including exact) so user can confirm selection
        const has = candidates && candidates.length > 0;
        if (has) {
          // 先渲染 DOM（showCandidates=true），再短延迟激活动画类（dropdownActive=true）
          that.setData(
            {
              communityChecked: exact,
              candidates,
              showCandidates: true,
              dropdownActive: false,
            },
            () => {
              // 下一帧激活动画
              setTimeout(() => {
                that.setData({ dropdownActive: true });
              }, 20);
            }
          );
        } else {
          that.setData({
            communityChecked: exact,
            candidates: [],
            // ensure dropdown hidden
            dropdownActive: false,
            showCandidates: false,
          });
        }
      },
      fail() {
        that.setData({ communityChecked: false });
      },
    });
  },

  // 用户从候选中选择某项
  selectCandidate(e) {
    const idx =
      e &&
      e.currentTarget &&
      e.currentTarget.dataset &&
      e.currentTarget.dataset.idx;
    if (idx === undefined || idx === null) return;
    const cand = this.data.candidates && this.data.candidates[idx];
    if (!cand) return;
    // 填充社区名及可用的 region/address 信息
    const region = cand.region || [];
    const regionDisplay = region.length ? region.join(" / ") : "";
    this.setData(
      {
        communityName: cand.name || "",
        region,
        regionDisplay,
        communityChecked: true,
        showCandidates: false,
      },
      () => {
        this.checkCanSubmit();
      }
    );
  },

  // 隐藏候选（用于点击外部或清空）
  hideCandidates() {
    // 先移除激活类以触发淡出动画，动画结束后由 transitionend 事件真正移除 DOM
    if (!this.data.showCandidates) return;
    this.setData({ dropdownActive: false });
  },

  // 下拉 transition/动画结束回调（用于在隐藏动画完成后移除 DOM）
  onDropdownTransitionEnd() {
    // 当动画结束且当前不是激活状态时，卸载下拉 DOM
    if (!this.data.dropdownActive && this.data.showCandidates) {
      this.setData({ showCandidates: false, candidates: [] });
    }
  },

  // 提交绑定信息
  onSubmit() {
    const {
      phone,
      name,
      region,
      communityName,
      building,
      block,
      room,
      residentialArea,
      commercialArea,
      parkingArea,
      carNumber,
      communityChecked,
    } = this.data;

    // 表单验证
    if (!name) {
      wx.showToast({ title: "请输入姓名", icon: "none" });
      return;
    }
    if (!region || region.length !== 3) {
      wx.showToast({ title: "请选择省/市/区", icon: "none" });
      return;
    }
    if (!communityName) {
      wx.showToast({ title: "请输入小区名称", icon: "none" });
      return;
    }
    if (communityChecked !== true) {
      wx.showToast({ title: "该小区未在系统中注册", icon: "none" });
      return;
    }
    if (!building || !block || !room) {
      wx.showToast({ title: "请填写完整的房屋信息", icon: "none" });
      return;
    }

    const app = getApp();
    const payload = {
      openid: app.globalData.openid,
      phone,
      name,
      region,
      communityName,
      building,
      block,
      room,
      residentialArea: parseFloat(residentialArea) || 0,
      commercialArea: parseFloat(commercialArea) || 0,
      parkingArea: parseFloat(parkingArea) || 0,
      carNumber: carNumber || "",
    };

    wx.showLoading({ title: "提交中..." });

    wx.cloud.callFunction({
      name: "submitBinding",
      data: payload,
      success: (res) => {
        wx.hideLoading();

        if (res.result && res.result.success) {
          wx.showToast({ title: "提交成功", icon: "success" });
          this.setData({
            bindingStatus: "pending",
            currentStep: 3,
          });

          // 更新app全局状态
          app.globalData.bindingStatus = "pending";
        } else {
          wx.showToast({
            title: res.result?.error || "提交失败",
            icon: "none",
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error("提交失败:", err);
        wx.showToast({ title: "提交失败，请重试", icon: "none" });
      },
    });
  },

  // 返回首页
  backToHome() {
    wx.switchTab({ url: "/pages/vote/index" });
  },

  // 重新提交
  resubmit() {
    this.setData({
      currentStep: 2,
      bindingStatus: "none",
    });
  },
});
