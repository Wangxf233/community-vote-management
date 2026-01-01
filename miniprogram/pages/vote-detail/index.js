const app = getApp();

Page({
  data: {
    voteId: null,
    voteType: "vote", // vote: 投票表决, survey: 问卷调查
    voteDetail: {},
    selectedOption: null,
    myVoteRecord: {},
  },

  onLoad(options) {
    // 检查是否是家属
    const bindingInfo = app.globalData.bindingInfo;
    if (bindingInfo && bindingInfo.type === "family") {
      wx.showModal({
        title: "功能限制",
        content: "家属账号暂不支持投票功能，请使用户主账号进行投票",
        showCancel: false,
        success: () => {
          wx.navigateBack({
            fail: () => {
              wx.switchTab({
                url: "/pages/service/index",
              });
            },
          });
        },
      });
      return;
    }

    const { id, type } = options;
    this.setData({
      voteId: id,
      voteType: type || "vote",
    });

    // 先检查实名认证状态
    this.checkRealNameStatus();
  },

  // 检查实名认证状态
  checkRealNameStatus() {
    wx.showLoading({ title: "验证中..." });

    wx.cloud.callFunction({
      name: "verifyRealName",
      data: {},
      success: (res) => {
        wx.hideLoading();

        if (res.result.success) {
          const { status, reason } = res.result.data;

          if (status === "approved" || status === "verified") {
            // 已通过认证，可以查看投票详情
            this.loadVoteDetail();
          } else if (status === "pending") {
            // 审核中
            wx.showModal({
              title: "实名认证审核中",
              content:
                "您的实名认证正在审核中，请耐心等待。审核通过后即可参与投票。",
              showCancel: false,
              success: () => {
                wx.navigateBack({
                  fail: () => {
                    wx.switchTab({
                      url: "/pages/service/index",
                    });
                  },
                });
              },
            });
          } else if (status === "rejected") {
            // 已拒绝
            wx.showModal({
              title: "实名认证未通过",
              content: `拒绝原因：${reason}\n\n请重新提交认证资料`,
              confirmText: "去认证",
              success: (modalRes) => {
                if (modalRes.confirm) {
                  const redirectUrl = `/pages/vote-detail/index?id=${this.data.voteId}&type=${this.data.voteType}`;
                  wx.redirectTo({
                    url: `/pages/verification/index?redirect=${encodeURIComponent(
                      redirectUrl
                    )}`,
                  });
                } else {
                  wx.navigateBack({
                    fail: () => {
                      wx.switchTab({
                        url: "/pages/service/index",
                      });
                    },
                  });
                }
              },
            });
          } else {
            // 未认证或其他状态 (unverified 或 undefined)
            wx.showModal({
              title: "需要实名认证",
              content: "参与投票需要完成实名认证，是否现在去认证？",
              confirmText: "去认证",
              cancelText: "取消",
              success: (modalRes) => {
                if (modalRes.confirm) {
                  const redirectUrl = `/pages/vote-detail/index?id=${this.data.voteId}&type=${this.data.voteType}`;
                  wx.redirectTo({
                    url: `/pages/verification/index?redirect=${encodeURIComponent(
                      redirectUrl
                    )}`,
                  });
                } else {
                  wx.navigateBack({
                    fail: () => {
                      wx.switchTab({
                        url: "/pages/service/index",
                      });
                    },
                  });
                }
              },
            });
          }
        } else {
          // 验证失败，可能是没有绑定信息等情况
          const errorMsg = res.result.message || "验证失败";

          // 无论什么错误，都引导用户去认证页面
          wx.showModal({
            title: "需要实名认证",
            content: `${errorMsg}\n\n请完成实名认证（上传身份证和房产证明）`,
            confirmText: "去认证",
            cancelText: "取消",
            success: (modalRes) => {
              if (modalRes.confirm) {
                const redirectUrl = `/pages/vote-detail/index?id=${this.data.voteId}&type=${this.data.voteType}`;
                wx.redirectTo({
                  url: `/pages/verification/index?redirect=${encodeURIComponent(
                    redirectUrl
                  )}`,
                });
              } else {
                wx.navigateBack({
                  fail: () => {
                    wx.switchTab({
                      url: "/pages/service/index",
                    });
                  },
                });
              }
            },
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error("verifyRealName 调用失败:", err);

        // 云函数调用失败，引导用户去认证
        wx.showModal({
          title: "无法验证状态",
          content: "请完成实名认证（上传身份证和房产证明）后再参与投票",
          confirmText: "去认证",
          cancelText: "返回",
          success: (modalRes) => {
            if (modalRes.confirm) {
              const redirectUrl = `/pages/vote-detail/index?id=${this.data.voteId}&type=${this.data.voteType}`;
              wx.redirectTo({
                url: `/pages/verification/index?redirect=${encodeURIComponent(
                  redirectUrl
                )}`,
              });
            } else {
              wx.navigateBack({
                fail: () => {
                  wx.switchTab({
                    url: "/pages/service/index",
                  });
                },
              });
            }
          },
        });
      },
    });
  },

  loadVoteDetail() {
    wx.showLoading({
      title: "加载中...",
    });

    wx.cloud.callFunction({
      name: "getVoteDetail",
      data: {
        voteId: this.data.voteId,
      },
      success: (res) => {
        wx.hideLoading();

        if (res.result.success) {
          const voteData = res.result.data;

          // 确保 showResult 字段总为布尔值，后端未返回时默认为 false
          voteData.showResult = !!voteData.showResult;

          this.setData({
            voteDetail: voteData,
            myVoteRecord: voteData.myVoteRecord || {},
          });
        } else {
          wx.showToast({
            title: res.result.error || "加载失败",
            icon: "none",
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error("加载投票详情失败:", err);
        wx.showToast({
          title: "加载失败",
          icon: "none",
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      },
    });
  },

  selectOption(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      selectedOption: index,
    });
  },

  submitVote() {
    if (this.data.selectedOption === null) {
      wx.showToast({
        title: "请选择投票选项",
        icon: "none",
      });
      return;
    }

    // 检查签名组件
    const signaturePad = this.selectComponent("#signaturePad");
    if (!signaturePad) {
      wx.showToast({
        title: "签名组件未加载，请稍后重试",
        icon: "none",
      });
      return;
    }

    if (signaturePad.checkEmpty()) {
      wx.showToast({
        title: "请先完成手写签名",
        icon: "none",
      });
      return;
    }

    const selectedOption =
      this.data.voteDetail.options[this.data.selectedOption];

    wx.showModal({
      title: "确认投票",
      content: `您确定要选择"${selectedOption.text}"吗？投票后不可更改。`,
      confirmColor: "#1AAD19",
      success: (res) => {
        if (res.confirm) {
          this.doVote(selectedOption.id, signaturePad);
        }
      },
    });
  },

  async doVote(optionId, signaturePad) {
    wx.showLoading({
      title: "提交中...",
    });

    try {
      // 获取签名图片
      const signaturePath = await signaturePad.getSignatureImage();

      // 上传签名图片到云存储
      const cloudPath = `signatures/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.png`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: signaturePath,
      });

      // 将 fileID 转换为永久 HTTPS 链接
      const tempUrlRes = await wx.cloud.getTempFileURL({
        fileList: [uploadRes.fileID],
      });

      let signatureUrl = uploadRes.fileID;
      if (tempUrlRes.fileList && tempUrlRes.fileList[0]) {
        // 获取下载链接（这个链接可以长期使用）
        signatureUrl =
          tempUrlRes.fileList[0].download_url ||
          tempUrlRes.fileList[0].tempFileURL;
      }

      // 调用云函数提交投票
      const res = await wx.cloud.callFunction({
        name: "updateVote",
        data: {
          voteId: this.data.voteId,
          optionId: optionId,
          signatureUrl: signatureUrl,
        },
      });
      wx.hideLoading();

      if (res.result && res.result.success) {
        // 尝试用返回的数据立即更新界面，避免 getVoteDetail 中的 hasVoted 判断因 openid 问题导致界面不刷新
        try {
          if (res.result.myVoteRecord) {
            this.setData({
              myVoteRecord: {
                optionText:
                  (this.data.voteDetail.options || []).find(
                    (o) => o.id === res.result.myVoteRecord.optionId
                  )?.text || "",
                voteTime: new Date().toLocaleString(),
              },
            });
          }

          // 如果后台允许展示结果，强制本地标记已投票并更新统计
          if (res.result.showResult) {
            const updatedOptions = (this.data.voteDetail.options || []).map(
              (opt) => ({
                ...opt,
                count:
                  (res.result.optionCounts || {})[opt.id] || opt.count || 0,
                percent:
                  res.result.totalVotes > 0
                    ? (
                        (((res.result.optionCounts || {})[opt.id] ||
                          opt.count ||
                          0) /
                          res.result.totalVotes) *
                        100
                      ).toFixed(1)
                    : opt.percent || 0,
              })
            );

            this.setData({
              "voteDetail.options": updatedOptions,
              "voteDetail.totalVotes": res.result.totalVotes || 0,
              "voteDetail.showResult": !!res.result.showResult,
              "voteDetail.hasVoted": true,
            });
          } else {
            // 依然请求最新详情以确保其它字段同步
            this.loadVoteDetail();
          }
        } catch (e) {
          console.warn("apply immediate update failed", e);
          this.loadVoteDetail();
        }

        wx.showToast({
          title: "投票成功",
          icon: "success",
          duration: 2000,
        });
      } else {
        wx.showToast({
          title: res.result?.error || "投票失败",
          icon: "none",
        });
      }
    } catch (err) {
      console.error("投票失败:", err);
      wx.hideLoading();
      wx.showToast({
        title: err.message || "提交失败",
        icon: "none",
      });
    }
  },

  previewAttachment(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      wx.showToast({ title: "无可用附件链接", icon: "none" });
      return;
    }

    const isImage = (u) => /\.(png|jpe?g|gif|bmp|webp)(\?.*)?$/i.test(u || "");

    wx.showLoading({ title: "加载中..." });

    // cloud:// 路径需先换成临时可访问链接
    if (url.startsWith("cloud://")) {
      wx.cloud.getTempFileURL({
        fileList: [url],
        success: (res) => {
          wx.hideLoading();
          if (
            res &&
            res.fileList &&
            res.fileList[0] &&
            (res.fileList[0].tempFileURL || res.fileList[0].download_url)
          ) {
            const tmp =
              res.fileList[0].download_url || res.fileList[0].tempFileURL;
            if (isImage(tmp)) {
              wx.previewImage({ urls: [tmp] });
            } else {
              wx.showLoading({ title: "下载中..." });
              wx.downloadFile({
                url: tmp,
                success: (dres) => {
                  wx.hideLoading();
                  if (dres.statusCode === 200 && dres.tempFilePath) {
                    wx.openDocument({ filePath: dres.tempFilePath });
                  } else {
                    wx.showToast({ title: "下载失败", icon: "none" });
                  }
                },
                fail: () => {
                  wx.hideLoading();
                  wx.showToast({ title: "下载失败", icon: "none" });
                },
              });
            }
          } else {
            wx.showToast({ title: "无法获取附件链接", icon: "none" });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error("getTempFileURL failed:", err);
          wx.showToast({ title: "无法获取附件链接", icon: "none" });
        },
      });
      return;
    }

    // 普通 http(s) 链接
    if (isImage(url)) {
      wx.hideLoading();
      wx.previewImage({ urls: [url] });
      return;
    }

    // 其他类型文件，先下载再打开
    wx.downloadFile({
      url,
      success: (dres) => {
        wx.hideLoading();
        if (dres.statusCode === 200 && dres.tempFilePath) {
          wx.openDocument({
            filePath: dres.tempFilePath,
            fail: (e) => {
              console.error("openDocument fail", e);
              wx.showToast({ title: "打开失败", icon: "none" });
            },
          });
        } else {
          wx.showToast({ title: "下载失败", icon: "none" });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error("downloadFile failed:", err);
        wx.showToast({ title: "下载失败", icon: "none" });
      },
    });
  },

  onShareAppMessage() {
    return {
      title: this.data.voteDetail.title,
      path: `/pages/vote-detail/index?id=${this.data.voteId}&type=${this.data.voteType}`,
    };
  },
});
