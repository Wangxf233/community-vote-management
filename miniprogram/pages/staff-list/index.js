Page({
  data: {
    statusBarHeight: 0,
    searchKeyword: "",
    selectedStaff: null,
    staffList: [
      {
        id: 1,
        name: "小王",
        position: "项目经理",
        description: "工作范围：负责小区事物统筹，啦啦啦啦啦啦啦啦",
        avatar: "/images/avatar1.png",
      },
      {
        id: 2,
        name: "小李",
        position: "副经理",
        description: "工作范围：负责小区事物统筹，啦啦啦啦啦啦啦啦",
        avatar: "/images/avatar2.png",
      },
      {
        id: 3,
        name: "小张",
        position: "维修主管",
        description: "工作范围：负责小区维修工作安排和协调",
        avatar: "/images/avatar3.png",
      },
      {
        id: 4,
        name: "小刘",
        position: "保洁主管",
        description: "工作范围：负责小区环境卫生管理和保洁工作",
        avatar: "/images/avatar4.png",
      },
      {
        id: 5,
        name: "小陈",
        position: "保安队长",
        description: "工作范围：负责小区安全巡逻和秩序维护",
        avatar: "/images/avatar5.png",
      },
    ],
    filteredStaffList: [],
  },

  onLoad() {
    // 获取状态栏高度
    this.getSystemInfo();

    // 初始化过滤列表
    this.setData({
      filteredStaffList: this.data.staffList,
    });
  },

  onReady() {
    // 确保页面布局正确
    this.adjustLayout();
  },

  getSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync();

      // 设置状态栏高度
      this.setData({
        statusBarHeight: systemInfo.statusBarHeight,
      });

      // 计算导航栏总高度
      const navBarHeight = systemInfo.statusBarHeight + 44; // 44是通常的导航栏高度
      this.setData({
        navBarHeight: navBarHeight,
      });
    } catch (err) {
      console.error("获取系统信息失败:", err);
      // 设置默认值
      this.setData({
        statusBarHeight: 44,
      });
    }
  },

  adjustLayout() {
    // 确保内容正确显示
    const query = wx.createSelectorQuery();
    query.select(".search-header").boundingClientRect();
    query.exec((res) => {
      if (res[0]) {
      }
    });
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword,
    });
    this.filterStaffList(keyword);
  },

  onSearchConfirm() {
    this.filterStaffList(this.data.searchKeyword);
  },

  clearSearch() {
    this.setData({
      searchKeyword: "",
    });
    this.filterStaffList("");
  },

  filterStaffList(keyword) {
    if (!keyword.trim()) {
      this.setData({
        filteredStaffList: this.data.staffList,
      });
      return;
    }

    const filtered = this.data.staffList.filter(
      (staff) =>
        staff.name.includes(keyword) ||
        staff.position.includes(keyword) ||
        staff.description.includes(keyword)
    );

    this.setData({
      filteredStaffList: filtered,
    });
  },

  selectStaff(e) {
    const staff = e.currentTarget.dataset.staff;
    // 立即将选中人员传回上一页并返回
    this.setData({
      selectedStaff: staff,
    });

    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2]; // 评价页面

    if (prevPage) {
      prevPage.setData({
        selectedStaff: staff,
      });

      if (prevPage.checkCanSubmit) {
        prevPage.checkCanSubmit();
      }

      wx.showToast({
        title: "选择成功",
        icon: "success",
        duration: 800,
      });
    }

    // 短延迟以便用户看到提示，然后返回上一页
    setTimeout(() => {
      wx.navigateBack();
    }, 500);
  },

  confirmSelection() {
    if (!this.data.selectedStaff) {
      wx.showToast({
        title: "请选择服务人员",
        icon: "none",
      });
      return;
    }

    // 获取页面栈
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2]; // 评价页面

    if (prevPage) {
      // 直接设置评价页面的数据
      prevPage.setData({
        selectedStaff: this.data.selectedStaff,
      });

      // 如果评价页面有检查提交状态的方法，调用它
      if (prevPage.checkCanSubmit) {
        prevPage.checkCanSubmit();
      }

      wx.showToast({
        title: "选择成功",
        icon: "success",
      });
    }

    // 延迟返回，让用户看到成功提示
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },

  goBack() {
    wx.navigateBack();
  },
});
