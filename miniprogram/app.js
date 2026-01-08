// app.js
const cloudImages = require("./config/cloudImages");

App({
  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: "cloud1-6ghienoi526fff51",
        traceUser: true,
      });
    }

    // 静默登录并检查绑定状态
    this.silentLogin();
  },

  onShow() {
    // 小程序从后台进入前台时，检查未读公告
    if (this.globalData.communityId) {
      this.checkUnreadAnnouncements();
    }
  },

  globalData: {
    userInfo: null,
    openid: null,
    bindingStatus: "none", // none, guest, pending, approved, rejected
    bindingInfo: null,
    communityId: null, // 社区ID
    cloudImages: cloudImages, // 云存储图片配置
  },

  // 静默登录获取openid
  async silentLogin() {
    try {
      const res = await wx.cloud.callFunction({
        name: "wxContext",
      });

      if (res.result && res.result.openid) {
        this.globalData.openid = res.result.openid;

        // 检查绑定状态
        await this.checkBindingStatus();
      }
    } catch (err) {
      console.error("静默登录失败:", err);
    }
  },

  // 检查绑定状态
  async checkBindingStatus() {
    try {
      // 先检查本地存储的状态
      const localStatus = wx.getStorageSync("bindingStatus");
      const hasSeenWelcome = wx.getStorageSync("hasSeenWelcome");

      // 调用云函数获取最新状态
      const res = await wx.cloud.callFunction({
        name: "getBindingInfo",
        data: {
          openid: this.globalData.openid,
        },
      });

      if (res.result && res.result.success) {
        const binding = res.result.binding;

        if (binding) {
          // 有绑定记录，更新状态
          this.globalData.bindingStatus = binding.status;
          this.globalData.bindingInfo = binding;
          this.globalData.communityId = binding.communityId;
          wx.setStorageSync("bindingStatus", binding.status);
          wx.setStorageSync("communityId", binding.communityId);

          // 绑定成功后检查未读公告
          if (binding.status === "approved" && binding.communityId) {
            this.checkUnreadAnnouncements();
          }
        } else {
          // 无绑定记录，检查是否是游客模式
          if (localStatus === "guest") {
            this.globalData.bindingStatus = "guest";
          } else {
            this.globalData.bindingStatus = "none";
          }

          // 如果是首次访问且未绑定，跳转到欢迎页
          if (!hasSeenWelcome && localStatus !== "guest") {
            wx.reLaunch({
              url: "/pages/welcome/index",
            });
            // 跳转成功后再标记已看过
            wx.setStorageSync("hasSeenWelcome", true);
          }
        }
      }
    } catch (err) {
      console.error("检查绑定状态失败:", err);

      // 如果获取失败，使用本地缓存的状态
      const localStatus = wx.getStorageSync("bindingStatus");
      const localCommunityId = wx.getStorageSync("communityId");
      if (localStatus) {
        this.globalData.bindingStatus = localStatus;
      }
      if (localCommunityId) {
        this.globalData.communityId = localCommunityId;
      }
    }
  },

  // 检查未读公告并显示通知
  async checkUnreadAnnouncements() {
    try {
      const res = await wx.cloud.callFunction({
        name: "getUnreadAnnouncementCount",
        data: {
          communityId: this.globalData.communityId,
        },
      });

      if (res.result && res.result.success) {
        const { unreadCount, byType } = res.result.data;

        // 如果有未读公告，显示通知
        if (unreadCount > 0) {
          const lastNotifyTime =
            wx.getStorageSync("lastAnnouncementNotifyTime") || 0;
          const now = Date.now();

          // 每24小时最多提示一次
          if (now - lastNotifyTime > 24 * 60 * 60 * 1000) {
            let content = `您有${unreadCount}条未读信息`;
            if (byType.committee > 0) {
              content += `\n业委会信息: ${byType.committee}条`;
            }
            if (byType.property > 0) {
              content += `\n物业信息: ${byType.property}条`;
            }
            if (byType.law > 0) {
              content += `\n法律法规: ${byType.law}条`;
            }

            wx.showModal({
              title: "📢 新消息通知",
              content: content,
              confirmText: "查看",
              cancelText: "稍后",
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.switchTab({
                    url: "/pages/information/index",
                  });
                }
                // 记录通知时间
                wx.setStorageSync("lastAnnouncementNotifyTime", now);
              },
            });
          }
        }
      }
    } catch (err) {
      console.error("检查未读公告失败:", err);
    }
  },

  // 检查权限
  checkUserPermission(requiredStatus = "approved") {
    if (this.globalData.bindingStatus !== requiredStatus) {
      return false;
    }
    return true;
  },

  // 要求权限（弹出提示）
  requirePermission(action = "进行此操作") {
    const status = this.globalData.bindingStatus;

    if (status === "none" || status === "guest") {
      wx.showModal({
        title: "需要绑定",
        content: `您需要绑定业主信息才能${action}`,
        confirmText: "去绑定",
        cancelText: "取消",
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: "/pages/welcome/index",
            });
          }
        },
      });
      return false;
    } else if (status === "pending") {
      wx.showModal({
        title: "审核中",
        content: "您的信息正在审核中，请耐心等待",
        showCancel: false,
      });
      return false;
    } else if (status === "rejected") {
      wx.showModal({
        title: "审核未通过",
        content: "您的绑定申请未通过审核，请重新提交",
        confirmText: "重新提交",
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: "/pages/welcome/index",
            });
          }
        },
      });
      return false;
    }

    return true;
  },
});
