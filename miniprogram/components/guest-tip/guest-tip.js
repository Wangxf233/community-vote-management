Component({
  properties: {
    show: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    bindingStatus: "none",
  },

  lifetimes: {
    attached() {
      const app = getApp();
      this.setData({
        bindingStatus: app.globalData.bindingStatus,
      });
    },
  },

  methods: {
    goBind() {
      wx.navigateTo({
        url: "/pages/bind-info/index",
      });
    },
  },
});
