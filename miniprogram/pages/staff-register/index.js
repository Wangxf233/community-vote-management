Page({
  data: {
    name: "",
    phone: "",
    position: "",
    communityName: "",
    selectedCommunityId: "",
    region: ["", "", ""],
    communityList: [],
    showCommunityList: false,
    submitting: false,
  },

  checkCommunityTimer: null,

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPositionInput(e) {
    this.setData({ position: e.detail.value });
  },

  // 省市区选择（完全复刻户主注册页）
  onRegionChange(e) {
    this.setData({ region: e.detail.value });

    if (e.detail.value[2]) {
      this.loadCommunitiesByRegion();
    }

    const communityName = this.data.communityName.trim();
    if (communityName) {
      this.debouncedCheckCommunity();
    }
  },

  // 加载指定区域的小区列表
  async loadCommunitiesByRegion() {
    try {
      let [province, city, district] = this.data.region;

      const municipalities = ["北京市", "天津市", "上海市", "重庆市"];
      if (municipalities.includes(province) && city === province) {
        city = "市辖区";
      }

      const result = await wx.cloud.callFunction({
        name: "listCommunitiesByRegion",
        data: { province, city, district },
      });

      if (result.result && result.result.code === 0) {
        this.setData({ communityList: result.result.data || [] });
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
    if (this.data.region[2]) {
      this.setData({ showCommunityList: true });
      if (this.data.communityList.length === 0) {
        this.loadCommunitiesByRegion();
      }
    } else {
      wx.showToast({ title: "请先选择省市区", icon: "none" });
    }
  },

  onCommunityBlur() {
    setTimeout(() => {
      this.setData({ showCommunityList: false });
    }, 200);
  },

  onCommunityInput(e) {
    this.setData({ communityName: e.detail.value, selectedCommunityId: "" });
    if (e.detail.value.trim()) {
      this.debouncedCheckCommunity();
    } else {
      if (this.checkCommunityTimer) {
        clearTimeout(this.checkCommunityTimer);
        this.checkCommunityTimer = null;
      }
    }
  },

  debouncedCheckCommunity() {
    if (this.checkCommunityTimer) clearTimeout(this.checkCommunityTimer);
    this.checkCommunityTimer = setTimeout(() => {
      const name = this.data.communityName.trim();
      if (name) this.checkCommunity(name);
    }, 800);
  },

  async checkCommunity(communityName) {
    const [province, city] = this.data.region;
    if (!province) return;

    try {
      const res = await wx.cloud.callFunction({
        name: "checkCommunity",
        data: { keyword: communityName, province, city },
      });

      if (res.result && res.result.code === 0) {
        const list = res.result.data || [];
        // 自动匹配：如果输入的名称与列表第一项完全一致，自动捕获 _id
        const exact = list.find((c) => c.name === communityName);
        this.setData({
          communityList: list,
          showCommunityList: true,
          selectedCommunityId: exact ? exact._id || "" : this.data.selectedCommunityId,
        });
      }
    } catch (err) {
      console.error("检索小区失败:", err);
    }
  },

  // 选择小区
  onSelectCommunity(e) {
    const communityName = e.currentTarget.dataset.name;
    const communityId = e.currentTarget.dataset.id || "";
    this.setData({
      communityName,
      selectedCommunityId: communityId,
      showCommunityList: false,
    });
    this.checkCommunity(communityName);
  },

  // 提交
  async onSubmit() {
    const { name, phone, position, communityName, region } = this.data;

    if (!name.trim()) {
      wx.showToast({ title: "请输入姓名", icon: "none" });
      return;
    }
    if (!phone.trim()) {
      wx.showToast({ title: "请输入手机号", icon: "none" });
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      wx.showToast({ title: "手机号格式不正确", icon: "none" });
      return;
    }
    if (!communityName.trim()) {
      wx.showToast({ title: "请选择小区", icon: "none" });
      return;
    }

    this.setData({ submitting: true });

    try {
      const res = await wx.cloud.callFunction({
        name: "staffRegister",
        data: {
          communityId: this.data.selectedCommunityId || communityName.trim(),
          name: name.trim(),
          phone: phone.trim(),
          position: position.trim(),
        },
      });

      if (res.result && res.result.success) {
        wx.showToast({ title: "提交成功，请等待审核", icon: "success", duration: 2000 });
        setTimeout(() => wx.navigateBack(), 2000);
      } else {
        wx.showToast({ title: (res.result && res.result.error) || "提交失败", icon: "none" });
      }
    } catch (err) {
      console.error("staffRegister error:", err);
      wx.showToast({ title: "提交失败，请重试", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
