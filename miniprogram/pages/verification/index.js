const app = getApp();

Page({
  data: {
    verificationStatus: null, // null: 未认证, pending: 审核中, approved: 已通过, rejected: 已拒绝
    statusText: "",
    rejectReason: "",

    // 上传的图片
    idCardFront: "",
    idCardBack: "",
    certType: "", // property: 房产证, contract: 购房合同, payment: 缴费证明
    propertyCert: "",
    contract: "",
    payment: "",

    // 身份证识别信息
    idCardInfo: {
      name: "",
      idNum: "",
      sex: "",
      nation: "",
      birth: "",
      address: "",
      authority: "",
      validDate: "",
    },

    submitting: false,
    redirectUrl: "", // 认证成功后跳转的地址
  },

  onLoad(options) {
    const { redirect } = options;
    if (redirect) {
      this.setData({ redirectUrl: decodeURIComponent(redirect) });
    }

    this.checkVerificationStatus();
  },

  // 检查认证状态
  checkVerificationStatus() {
    wx.showLoading({ title: "加载中..." });

    wx.cloud.callFunction({
      name: "verifyRealName",
      data: {},
      success: (res) => {
        wx.hideLoading();
        if (res.result.success) {
          const { status, reason } = res.result.data;
          let statusText = "";

          switch (status) {
            case "pending":
              statusText = "审核中";
              break;
            case "approved":
              statusText = "已通过";
              break;
            case "rejected":
              statusText = "未通过";
              break;
            default:
              statusText = "未认证";
          }

          this.setData({
            verificationStatus: status,
            statusText: statusText,
            rejectReason: reason || "审核未通过，请重新提交资料",
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error("检查认证状态失败:", err);
      },
    });
  },

  // 选择证明类型
  selectCertType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ certType: type });
  },

  // 上传身份证正面
  uploadIdCardFront() {
    this.chooseAndUploadImage("idCardFront", "id-card-front", "FRONT");
  },

  // 上传身份证反面
  uploadIdCardBack() {
    this.chooseAndUploadImage("idCardBack", "id-card-back", "BACK");
  },

  // 上传房产证
  uploadPropertyCert() {
    this.chooseAndUploadImage("propertyCert", "property-cert");
  },

  // 上传购房合同
  uploadContract() {
    this.chooseAndUploadImage("contract", "contract");
  },

  // 上传缴费证明
  uploadPayment() {
    this.chooseAndUploadImage("payment", "payment");
  },

  // 选择并上传图片
  chooseAndUploadImage(dataKey, folder, cardSide) {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;

        wx.showLoading({ title: "上传中..." });

        // 上传到云存储
        const cloudPath = `verification/${folder}/${Date.now()}-${Math.random()
          .toString(36)
          .substr(2)}.jpg`;

        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath,
          success: (uploadRes) => {
            const fileID = uploadRes.fileID;

            // 如果是身份证，进行OCR识别
            if (cardSide) {
              this.performOCR(fileID, cardSide, dataKey);
            } else {
              // 非身份证直接获取临时链接
              this.getTempURL(fileID, dataKey);
            }
          },
          fail: (err) => {
            wx.hideLoading();
            wx.showToast({
              title: "上传失败",
              icon: "none",
            });
            console.error("上传失败:", err);
          },
        });
      },
    });
  },

  // 获取临时链接
  getTempURL(fileID, dataKey) {
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: (urlRes) => {
        wx.hideLoading();
        if (urlRes.fileList && urlRes.fileList.length > 0) {
          const tempFileURL = urlRes.fileList[0].tempFileURL;
          this.setData({
            [dataKey]: tempFileURL,
          });

          wx.showToast({
            title: "上传成功",
            icon: "success",
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: "获取图片失败",
          icon: "none",
        });
      },
    });
  },

  // 执行OCR识别
  performOCR(fileID, cardSide, dataKey) {
    wx.showLoading({ title: "识别中..." });

    wx.cloud.callFunction({
      name: "idCardOCR",
      data: {
        imageUrl: fileID,
        cardSide: cardSide,
      },
      success: (res) => {
        wx.hideLoading();

        if (res.result.success) {
          // 识别成功，保存图片和信息
          wx.cloud.getTempFileURL({
            fileList: [fileID],
            success: (urlRes) => {
              if (urlRes.fileList && urlRes.fileList.length > 0) {
                const tempFileURL = urlRes.fileList[0].tempFileURL;

                // 更新图片
                this.setData({
                  [dataKey]: tempFileURL,
                });

                // 更新识别信息
                const idCardInfo = { ...this.data.idCardInfo };
                Object.assign(idCardInfo, res.result.data);
                this.setData({ idCardInfo });

                // 显示识别结果
                let message = "识别成功";
                if (res.result.quality) {
                  message += `\n图片质量：${res.result.quality}分`;
                }
                if (cardSide === "FRONT" && res.result.data.idNum) {
                  message += `\n身份证号：${res.result.data.idNum}`;
                  message += `\n姓名：${res.result.data.name}`;
                }

                wx.showModal({
                  title: "识别成功",
                  content: message,
                  showCancel: false,
                  confirmText: "确定",
                });
              }
            },
          });
        } else {
          // 识别失败或图片质量问题
          wx.showModal({
            title: "识别失败",
            content: res.result.message || "图片识别失败，请重新上传",
            showCancel: true,
            confirmText: "重新上传",
            cancelText: "继续使用",
            success: (modalRes) => {
              if (modalRes.confirm) {
                // 重新上传
                if (dataKey === "idCardFront") {
                  this.uploadIdCardFront();
                } else if (dataKey === "idCardBack") {
                  this.uploadIdCardBack();
                }
              } else {
                // 继续使用当前图片
                this.getTempURL(fileID, dataKey);
              }
            },
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error("OCR识别失败:", err);

        // OCR失败，但仍可以使用图片
        wx.showModal({
          title: "识别失败",
          content: "自动识别失败，是否继续使用该图片？",
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.getTempURL(fileID, dataKey);
            }
          },
        });
      },
    });
  },

  // 提交认证
  submitVerification() {
    const {
      idCardFront,
      idCardBack,
      certType,
      propertyCert,
      contract,
      payment,
      idCardInfo,
    } = this.data;

    // 验证必填项
    if (!idCardFront || !idCardBack) {
      wx.showToast({
        title: "请上传身份证正反面",
        icon: "none",
      });
      return;
    }

    // 检查是否识别到身份证号
    if (!idCardInfo.idNum) {
      wx.showModal({
        title: "提示",
        content: "未能识别到身份证号码，是否继续提交？",
        success: (res) => {
          if (res.confirm) {
            this.doSubmit();
          }
        },
      });
      return;
    }

    this.doSubmit();
  },

  // 执行提交
  doSubmit() {
    const {
      idCardFront,
      idCardBack,
      certType,
      propertyCert,
      contract,
      payment,
      idCardInfo,
    } = this.data;

    if (!certType) {
      wx.showToast({
        title: "请选择房产证明类型",
        icon: "none",
      });
      return;
    }

    // 验证已选择的证明是否上传
    let certImage = "";
    if (certType === "property" && !propertyCert) {
      wx.showToast({
        title: "请上传房产证",
        icon: "none",
      });
      return;
    } else if (certType === "contract" && !contract) {
      wx.showToast({
        title: "请上传购房合同",
        icon: "none",
      });
      return;
    } else if (certType === "payment" && !payment) {
      wx.showToast({
        title: "请上传缴费证明",
        icon: "none",
      });
      return;
    }

    if (certType === "property") certImage = propertyCert;
    else if (certType === "contract") certImage = contract;
    else if (certType === "payment") certImage = payment;

    this.setData({ submitting: true });
    wx.showLoading({ title: "提交中..." });

    wx.cloud.callFunction({
      name: "submitCertification",
      data: {
        type: "realname",
        idCardFront,
        idCardBack,
        certType,
        certImage,
        // 附加身份证识别信息
        idCardInfo,
      },
      success: (res) => {
        wx.hideLoading();
        this.setData({ submitting: false });

        if (res.result.success) {
          wx.showToast({
            title: "提交成功",
            icon: "success",
            duration: 2000,
          });

          setTimeout(() => {
            this.checkVerificationStatus();
          }, 2000);
        } else {
          wx.showToast({
            title: res.result.message || "提交失败",
            icon: "none",
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        wx.showToast({
          title: "提交失败",
          icon: "none",
        });
        console.error("提交失败:", err);
      },
    });
  },

  // 返回
  goBack() {
    if (this.data.redirectUrl) {
      wx.redirectTo({
        url: this.data.redirectUrl,
        fail: () => {
          wx.navigateBack();
        },
      });
    } else {
      wx.navigateBack();
    }
  },
});
