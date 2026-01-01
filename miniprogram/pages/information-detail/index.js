Page({
  data: {
    id: "",
    detailData: null,
    loading: true,
  },

  onLoad(options) {
    const { id } = options;
    if (!id) {
      wx.showToast({
        title: "参数错误",
        icon: "none",
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    this.setData({ id });
    this.loadDetailData(id);
  },

  // 加载公告详情
  loadDetailData(id) {
    wx.showLoading({ title: "加载中..." });

    wx.cloud
      .callFunction({
        name: "getAnnouncementDetail",
        data: {
          announcementId: id,
        },
      })
      .then((res) => {
        wx.hideLoading();

        if (res.result.success) {
          const data = res.result.data;

          // 格式化发布时间
          if (data.publishTime) {
            data.publishTime = this.formatTime(data.publishTime);
          }

          this.setData({
            detailData: data,
            loading: false,
          });

          // 设置导航栏标题
          wx.setNavigationBarTitle({
            title: data.title || "信息详情",
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
      })
      .catch((err) => {
        console.error("加载详情失败:", err);
        wx.hideLoading();
        wx.showToast({
          title: "加载失败",
          icon: "none",
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      });
  },

  // 格式化时间
  formatTime(publishTime) {
    const date = new Date(publishTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 下载附件
  downloadAttachment(e) {
    const { url, name } = e.currentTarget.dataset;

    if (!url) {
      wx.showToast({
        title: "附件地址无效",
        icon: "none",
      });
      return;
    }

    wx.showLoading({ title: "下载中..." });

    // 下载文件
    wx.downloadFile({
      url: url,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          const filePath = res.tempFilePath;

          // 获取文件扩展名
          const fileExtension = name.split(".").pop().toLowerCase();

          // 支持的文档类型
          const supportedDocs = [
            "doc",
            "docx",
            "xls",
            "xlsx",
            "ppt",
            "pptx",
            "pdf",
          ];

          if (supportedDocs.includes(fileExtension)) {
            // 文档类型，尝试打开
            wx.openDocument({
              filePath: filePath,
              fileType: fileExtension,
              success: () => {},
              fail: (err) => {
                console.error("打开文档失败:", err);
                wx.showModal({
                  title: "提示",
                  content: "无法打开该文件类型，文件已下载到临时目录",
                  showCancel: false,
                });
              },
            });
          } else {
            // 其他类型文件，只提示下载成功
            wx.showModal({
              title: "下载成功",
              content: "文件已保存到临时目录",
              showCancel: false,
            });
          }
        } else {
          wx.showToast({
            title: "下载失败",
            icon: "none",
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error("下载失败:", err);
        wx.showToast({
          title: "下载失败",
          icon: "none",
        });
      },
    });
  },

  // 预览图片附件
  previewImage(e) {
    const { url } = e.currentTarget.dataset;
    const { detailData } = this.data;

    // 获取所有图片附件的URL
    const imageUrls = detailData.attachments
      .filter((item) => item.type === "image")
      .map((item) => item.url);

    wx.previewImage({
      current: url,
      urls: imageUrls,
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadDetailData(this.data.id);
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },
});
