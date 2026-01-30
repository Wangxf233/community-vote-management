const { formatRoom } = require("../../utils/formatRoom.js");

Page({
  data: {
    houseList: [],
    loading: true,
    totalArea: 0, // 总面积
  },

  onLoad: function () {
    this.loadHouseList();
  },

  onShow: function () {
    // 每次显示页面时刷新数据
    this.loadHouseList();
  },

  // 加载房产列表
  loadHouseList: function () {
    const that = this;
    that.setData({ loading: true });

    wx.cloud
      .callFunction({
        name: "getMyHouses",
      })
      .then((res) => {
        console.log("getMyHouses result:", res);

        if (res.result && res.result.success) {
          const houses = res.result.data || [];
          let totalArea = 0;

          // 处理状态文本和房号格式
          houses.forEach((house) => {
            // 格式化房号为4位数
            if (house.room) {
              house.room = formatRoom(house.room);
            }

            // 累计总面积
            if (house.area) {
              const area = parseFloat(house.area);
              if (!isNaN(area)) {
                totalArea += area;
              }
            }

            if (house.status === "approved") {
              house.statusText = "已认证";
            } else if (house.status === "pending") {
              house.statusText = "审核中";
            } else if (house.status === "rejected") {
              house.statusText = "未通过";
            } else {
              house.statusText = "未知";
            }
          });

          that.setData({
            houseList: houses,
            totalArea: totalArea.toFixed(2), // 保留12位小数
            loading: false,
          });
        } else {
          wx.showToast({
            title: (res.result && res.result.error) || "加载失败",
            icon: "none",
          });
          that.setData({ loading: false });
        }
      })
      .catch((err) => {
        console.error("加载房产列表失败:", err);
        wx.showToast({
          title: "加载失败",
          icon: "none",
        });
        that.setData({ loading: false });
      });
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.loadHouseList();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },
});
