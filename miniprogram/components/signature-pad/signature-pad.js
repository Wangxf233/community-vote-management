Component({
  properties: {
    title: {
      type: String,
      value: "手写签名",
    },
  },

  data: {
    ctx: null,
    canvas: null,
    canvasWidth: 0,
    canvasHeight: 0,
    isDrawing: false,
    isEmpty: true,
    isReady: false,
    showModal: false,
    signatureImage: null,
    useType2D: false,
    isLandscapeMode: false,
  },

  lifetimes: {
    detached() {
      if (this.data.ctx) {
        this.setData({ ctx: null });
      }
    },
  },

  methods: {
    // 打开签名弹窗
    openSignature() {
      // 强制横屏并设置 landscape 标记
      wx.setPageOrientation({
        orientation: "landscape",
        success: () => {
          this.setData({ showModal: true, isLandscapeMode: true }, () => {
            // 弹窗打开后初始化画布
            setTimeout(() => {
              this.initCanvas();
            }, 500);
          });
        },
        fail: () => {
          // 若无法设置横屏，也继续打开弹窗
          this.setData({ showModal: true, isLandscapeMode: false }, () => {
            setTimeout(() => {
              this.initCanvas();
            }, 500);
          });
        },
      });
    },

    // 关闭弹窗
    closeModal() {
      // 恢复竖屏并清理 landscape 标记
      wx.setPageOrientation({
        orientation: "portrait",
        success: () => {
          this.setData({ showModal: false, isLandscapeMode: false });
        },
        fail: () => {
          this.setData({ showModal: false, isLandscapeMode: false });
        },
      });
    },

    // 阻止弹窗滚动穿透
    preventMove() {
      return false;
    },

    initCanvas() {
      const query = this.createSelectorQuery();
      query.select(".signature-canvas").boundingClientRect();
      query.exec((res) => {
        if (!res || !res[0]) {
          console.warn("签名画布未找到，将在500ms后重试");
          setTimeout(() => {
            if (this.data.showModal) {
              this.initCanvas();
            }
          }, 500);
          return;
        }

        const canvasWidth = res[0].width;
        const canvasHeight = res[0].height;

        this.setData({
          canvasWidth,
          canvasHeight,
        });

        try {
          // 使用新版 Canvas 2D API，兼容性更好
          const query2 = wx.createSelectorQuery().in(this);
          query2
            .select("#signatureCanvas")
            .fields({ node: true, size: true })
            .exec((res2) => {
              if (!res2 || !res2[0]) {
                console.error("Canvas 节点获取失败，尝试使用旧版 API");
                this.initCanvasLegacy(canvasWidth, canvasHeight);
                return;
              }

              const canvas = res2[0].node;
              const ctx = canvas.getContext("2d");

              const dpr = wx.getSystemInfoSync().pixelRatio;
              canvas.width = canvasWidth * dpr;
              canvas.height = canvasHeight * dpr;
              ctx.scale(dpr, dpr);

              ctx.strokeStyle = "#000000";
              ctx.lineWidth = 4;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";

              this.setData({
                ctx,
                canvas,
                isReady: true,
                useType2D: true,
              });
            });
        } catch (err) {
          console.error("初始化Canvas 2D失败，使用旧版API:", err);
          this.initCanvasLegacy(canvasWidth, canvasHeight);
        }
      });
    },

    initCanvasLegacy(canvasWidth, canvasHeight) {
      try {
        const ctx = wx.createCanvasContext("signatureCanvas", this);
        if (!ctx) {
          console.error("无法创建Canvas上下文");
          return;
        }

        ctx.setStrokeStyle("#000000");
        ctx.setLineWidth(4);
        ctx.setLineCap("round");
        ctx.setLineJoin("round");

        this.setData({
          ctx,
          isReady: true,
          useType2D: false,
        });
      } catch (err) {
        console.error("初始化签名画布失败:", err);
      }
    },

    touchStart(e) {
      const { ctx, useType2D } = this.data;
      if (!ctx) return;

      const touch = e.touches[0];

      if (useType2D) {
        ctx.beginPath();
        ctx.moveTo(touch.x, touch.y);
      } else {
        ctx.beginPath();
        ctx.moveTo(touch.x, touch.y);
      }

      this.setData({
        isDrawing: true,
        isEmpty: false,
      });
    },

    touchMove(e) {
      const { ctx, isDrawing, useType2D } = this.data;
      if (!ctx || !isDrawing) return;

      const touch = e.touches[0];

      if (useType2D) {
        ctx.lineTo(touch.x, touch.y);
        ctx.stroke();
      } else {
        ctx.lineTo(touch.x, touch.y);
        ctx.stroke();
        ctx.draw(true);
      }
    },

    touchEnd() {
      this.setData({ isDrawing: false });
    },

    clearSignature() {
      const { ctx, canvasWidth, canvasHeight, useType2D } = this.data;
      if (!ctx) return;

      if (useType2D) {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      } else {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.draw();
      }

      this.setData({ isEmpty: true });
    },

    // 确认签名
    confirmSignature() {
      if (this.data.isEmpty) {
        wx.showToast({
          title: "请先签名",
          icon: "none",
        });
        return;
      }

      wx.showLoading({ title: "处理中..." });

      const { useType2D, canvas } = this.data;

      if (useType2D && canvas) {
        // 使用新版 Canvas 2D API 导出图片
        wx.canvasToTempFilePath(
          {
            canvas: canvas,
            success: (res) => {
              wx.hideLoading();

              // 恢复竖屏并清理 landscape 标记
              wx.setPageOrientation({
                orientation: "portrait",
                success: () => {
                  this.setData({
                    signatureImage: res.tempFilePath,
                    showModal: false,
                    isLandscapeMode: false,
                  });
                  wx.showToast({
                    title: "签名成功",
                    icon: "success",
                  });
                },
                fail: () => {
                  this.setData({
                    signatureImage: res.tempFilePath,
                    showModal: false,
                    isLandscapeMode: false,
                  });
                  wx.showToast({
                    title: "签名成功",
                    icon: "success",
                  });
                },
              });
            },
            fail: (err) => {
              wx.hideLoading();
              console.error("获取签名图片失败:", err);
              wx.showToast({
                title: "签名失败，请重试",
                icon: "none",
              });
            },
          },
          this
        );
      } else {
        // 使用旧版 API
        wx.canvasToTempFilePath(
          {
            canvasId: "signatureCanvas",
            success: (res) => {
              wx.hideLoading();

              // 恢复竖屏
              wx.setPageOrientation({
                orientation: "portrait",
              });

              this.setData({
                signatureImage: res.tempFilePath,
                showModal: false,
              });
              wx.showToast({
                title: "签名成功",
                icon: "success",
              });
            },
            fail: (err) => {
              wx.hideLoading();
              console.error("获取签名图片失败:", err);
              wx.showToast({
                title: "签名失败，请重试",
                icon: "none",
              });
            },
          },
          this
        );
      }
    },

    // 获取签名图片
    getSignatureImage() {
      return new Promise((resolve, reject) => {
        if (!this.data.signatureImage) {
          reject(new Error("请先签名"));
          return;
        }
        resolve(this.data.signatureImage);
      });
    },

    // 检查是否已签名
    checkEmpty() {
      return !this.data.signatureImage;
    },
  },
});
