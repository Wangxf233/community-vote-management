Page({
  data: {
    agreed: false,
  },

  onLoad() {
    // 页面加载时检查登录状态
    const app = getApp();
    if (app && app.globalData && app.globalData.isLoggedIn) {
      wx.switchTab({ url: "/pages/vote/index" });
    }
  },

  // 微信一键登录（也可作为 getPhoneNumber 的回调）
  onWechatLogin(e) {
    if (!this.data.agreed) {
      wx.showToast({ title: "请先同意协议", icon: "none" });
      return;
    }

    const that = this;
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          wx.showToast({ title: "微信登录失败", icon: "none" });
          return;
        }

        const payload = {
          code: loginRes.code,
          encryptedData: e && e.detail ? e.detail.encryptedData : undefined,
          iv: e && e.detail ? e.detail.iv : undefined,
        };

        // 调用云函数进行登录/绑定检查
        if (!wx.cloud || !wx.cloud.callFunction) {
          console.warn("wx.cloud not available - running without cloud");
        }

        wx.cloud.callFunction({
          name: "wechatLogin",
          data: payload,
          success: async (res) => {
            const result = res && res.result ? res.result : {};
            if (!result || !result.success) {
              console.warn(
                "wechatLogin returned success:false or empty, result:",
                result
              );
              wx.showToast({
                title: (result && result.message) || "登录失败",
                icon: "none",
              });
              return;
            }

            // store token and user info, but suppress redirect because we will decide navigation after checking binding
            that.handleLoginSuccess(result, { suppressRedirect: true });

            // old mock returned bindingStatus/bindInfo directly; if present, reuse that
            if (result.bindingStatus) {
              const status = result.bindingStatus;
              const bindInfo = result.bindInfo
                ? encodeURIComponent(JSON.stringify(result.bindInfo))
                : undefined;
              const failReason = result.failReason
                ? encodeURIComponent(result.failReason)
                : undefined;
              let url = "/pages/bind-info/index?status=" + (status || "none");
              if (bindInfo) url += "&bindInfo=" + bindInfo;
              if (failReason) url += "&failReason=" + failReason;
              // set suppression flag so other pages don't auto switch
              const app = getApp();
              if (app && app.globalData)
                app.globalData._suppressAutoSwitch = true;
              wx.navigateTo({ url });
              return;
            }

            // Otherwise, call getBindingInfo to determine binding status for this user
            try {
              const g = await new Promise((resolve, reject) => {
                wx.cloud.callFunction({
                  name: "getBindingInfo",
                  data: {},
                  success: (r) => resolve(r),
                  fail: (e) => reject(e),
                });
              });
              const gi = g && g.result ? g.result : {};
              const status =
                gi && gi.status
                  ? gi.status
                  : gi.exists
                  ? gi.status || "pending"
                  : "none";

              // if binding exists or needs attention, navigate to bind-info
              if (gi && gi.exists) {
                const bindInfo = gi.info
                  ? encodeURIComponent(JSON.stringify(gi.info))
                  : undefined;
                const failReason = gi.failReason
                  ? encodeURIComponent(gi.failReason)
                  : undefined;
                let url =
                  "/pages/bind-info/index?status=" + (status || "pending");
                if (bindInfo) url += "&bindInfo=" + bindInfo;
                if (failReason) url += "&failReason=" + failReason;
                const app = getApp();
                if (app && app.globalData)
                  app.globalData._suppressAutoSwitch = true;
                wx.navigateTo({ url });
                return;
              }

              // no binding -> navigate to bind-info with none status
              const app = getApp();
              if (app && app.globalData)
                app.globalData._suppressAutoSwitch = true;
              wx.navigateTo({ url: "/pages/bind-info/index?status=none" });
            } catch (e) {
              console.error("getBindingInfo call failed", e);
              // fallback: redirect to vote tab
              wx.switchTab({ url: "/pages/vote/index" });
            }
          },
          fail(err) {
            console.error("wechatLogin call failed:", err);
            wx.showToast({
              title:
                err && err.errMsg
                  ? "登录出错: " + err.errMsg
                  : "登录出错，请重试",
              icon: "none",
            });
          },
        });
      },
      fail() {
        wx.showToast({ title: "微信登录失败", icon: "none" });
      },
    });
  },

  // 临时测试用：直接调用 mock wechatLogin（使用 mock_pending/mock_failed/mock_approved）
  testWechatLogin() {
    wx.showLoading({ title: "测试调用..." });
    wx.cloud.callFunction({
      name: "wechatLogin",
      data: { code: "mock_pending" },
      success(res) {
        wx.showToast({ title: "测试返回", icon: "success" });
      },
      fail(err) {
        console.error("testWechatLogin failed:", err);
        wx.showToast({ title: "调用失败，查看控制台", icon: "none" });
      },
      complete() {
        wx.hideLoading();
      },
    });
  },

  onAccountLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: "请先同意协议", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/account-login/index" });
  },

  onGuestLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: "请先同意协议", icon: "none" });
      return;
    }
    wx.showModal({
      title: "提示",
      content: "游客模式功能受限，是否继续？",
      success: (res) => {
        if (res.confirm) this.handleGuestLogin();
      },
    });
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  showServiceAgreement() {
    wx.navigateTo({ url: "/pages/agreement/service" });
  },
  showPrivacyPolicy() {
    wx.navigateTo({ url: "/pages/agreement/privacy" });
  },

  handleLoginSuccess(result, options = {}) {
    try {
      if (result && result.token) wx.setStorageSync("token", result.token);
    } catch (e) {
      console.warn("setStorageSync failed", e);
    }

    const app = getApp();
    if (app && app.globalData) {
      app.globalData.isLoggedIn = true;
      // accept either result.user (our DB-backed wechatLogin) or legacy result.userInfo
      app.globalData.userInfo = result.user || result.userInfo || {};
    }

    if (options.suppressRedirect) {
      wx.showToast({ title: "登录成功", icon: "success", duration: 800 });
      return;
    }

    wx.showToast({
      title: "登录成功",
      icon: "success",
      duration: 1500,
      success: () => {
        setTimeout(() => {
          wx.switchTab({ url: "/pages/vote/index" });
        }, 1500);
      },
    });
  },

  handleGuestLogin() {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.isLoggedIn = true;
      app.globalData.userInfo = { role: "guest" };
    }
    wx.showToast({
      title: "游客登录成功",
      icon: "success",
      duration: 1500,
      success: () => {
        setTimeout(() => {
          wx.switchTab({ url: "/pages/vote/index" });
        }, 1500);
      },
    });
  },
});
