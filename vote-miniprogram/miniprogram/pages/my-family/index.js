const app = getApp();

Page({
  data: {
    inviteCode: "",
    expiresAt: "",
    generating: false,
    familyList: [],
    loading: false,
  },

  onLoad() {
    this.loadFamilyList();
    this.loadExistingInviteCode();
  },

  onShow() {
    // 每次显示时刷新列表
    this.loadFamilyList();
    this.loadExistingInviteCode();
  },

  /**
   * 分享配置
   */
  onShareAppMessage() {
    const { inviteCode, expiresAt } = this.data;

    if (!inviteCode) {
      wx.showToast({
        title: "请先生成邀请码",
        icon: "none",
      });
      return {
        title: "邀请你成为我的家属",
        path: "/pages/index/index",
      };
    }

    return {
      title: `邀请码：${inviteCode}（有效期至${expiresAt}）`,
      path: "/pages/family-register/index?inviteCode=" + inviteCode,
      imageUrl: "", // 可以设置自定义分享图片
    };
  },

  /**
   * 加载已有的邀请码
   */
  async loadExistingInviteCode() {
    try {
      const result = await wx.cloud.callFunction({
        name: "generateInviteCode",
        data: {},
      });

      if (
        result.result &&
        result.result.code === 0 &&
        result.result.data.isExisting
      ) {
        const { inviteCode, expiresAt } = result.result.data;

        // 检查是否过期
        const expireDate = new Date(expiresAt);
        const now = new Date();

        if (expireDate > now) {
          // 格式化过期时间
          const formatted = `${expireDate.getFullYear()}-${String(
            expireDate.getMonth() + 1
          ).padStart(2, "0")}-${String(expireDate.getDate()).padStart(2, "0")}`;

          this.setData({
            inviteCode,
            expiresAt: formatted,
          });
        }
      }
    } catch (error) {
      // 静默失败，不显示错误
    }
  },

  /**
   * 生成邀请码
   */
  async generateInviteCode() {
    this.setData({ generating: true });

    try {
      // 如果已有邀请码，传入forceNew参数强制生成新的
      const result = await wx.cloud.callFunction({
        name: "generateInviteCode",
        data: {
          forceNew: !!this.data.inviteCode, // 如果已有邀请码，强制生成新的
        },
      });

      if (result.result && result.result.code === 0) {
        const { inviteCode, expiresAt } = result.result.data;

        // 格式化过期时间
        const date = new Date(expiresAt);
        const formatted = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

        this.setData({
          inviteCode,
          expiresAt: formatted,
        });

        wx.showToast({
          title: "生成成功",
          icon: "success",
        });
      } else {
        wx.showToast({
          title: result.result.message || "生成失败",
          icon: "none",
        });
      }
    } catch (error) {
      console.error("生成邀请码失败:", error);
      wx.showToast({
        title: "生成失败，请重试",
        icon: "none",
      });
    } finally {
      this.setData({ generating: false });
    }
  },

  /**
   * 复制邀请码
   */
  copyInviteCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        wx.showToast({
          title: "已复制",
          icon: "success",
        });
      },
    });
  },

  /**
   * 加载家属列表
   */
  async loadFamilyList() {
    this.setData({ loading: true });

    try {
      const result = await wx.cloud.callFunction({
        name: "getFamilyList",
        data: {},
      });

      if (result.result && result.result.code === 0) {
        this.setData({
          familyList: result.result.data.list || [],
        });
      } else {
        wx.showToast({
          title: result.result.message || "加载失败",
          icon: "none",
        });
      }
    } catch (error) {
      console.error("加载家属列表失败:", error);
      wx.showToast({
        title: "加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 移出家庭成员
   */
  removeMember(e) {
    const { id, name } = e.currentTarget.dataset;

    wx.showModal({
      title: "移出成员",
      content: `确定要移出"${name}"吗？移出后该成员需要重新提交认证申请。`,
      confirmText: "确定移出",
      confirmColor: "#ff4444",
      success: (res) => {
        if (res.confirm) {
          this.executeRemoveMember(id);
        }
      },
    });
  },

  /**
   * 执行移出操作
   */
  async executeRemoveMember(certificationId) {
    wx.showLoading({ title: "处理中..." });

    try {
      const result = await wx.cloud.callFunction({
        name: "removeFamilyMember",
        data: {
          certificationId: certificationId,
        },
      });

      wx.hideLoading();

      if (result.result && result.result.success) {
        wx.showToast({
          title: "已移出",
          icon: "success",
        });
        // 刷新列表
        this.loadFamilyList();
      } else {
        wx.showToast({
          title: result.result.error || "移出失败",
          icon: "none",
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error("移出成员失败:", err);
      wx.showToast({
        title: "移出失败，请重试",
        icon: "none",
      });
    }
  },

  /**
   * 解绑家属
   */
  handleUnbind(e) {
    const familyId = e.currentTarget.dataset.id;

    wx.showModal({
      title: "提示",
      content: "确定要解绑该家属吗？",
      success: (res) => {
        if (res.confirm) {
          this.unbindFamily(familyId);
        }
      },
    });
  },

  /**
   * 执行解绑操作
   */
  async unbindFamily(familyId) {
    wx.showLoading({ title: "处理中..." });

    try {
      const result = await wx.cloud.callFunction({
        name: "familyManagement",
        data: {
          action: "unbind",
          openid: app.globalData.openid,
          familyId,
        },
      });

      wx.hideLoading();

      if (result.result && result.result.success) {
        wx.showToast({
          title: "已解绑",
          icon: "success",
        });
        this.loadFamilyList();
      } else {
        wx.showToast({
          title: "解绑失败",
          icon: "none",
        });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: "解绑失败: " + err.message,
        icon: "none",
      });
    }
  },
});
