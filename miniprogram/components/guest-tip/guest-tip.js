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
      this.syncStatus();
    },
  },

  pageLifetimes: {
    show() {
      this.syncStatus();
    },
  },

  methods: {
    syncStatus() {
      const app = getApp();
      this.setData({
        bindingStatus: app.globalData.bindingStatus || "none",
      });
    },

    goBind() {
      wx.navigateTo({
        url: "/pages/welcome/index",
      });
    },
  },
});
