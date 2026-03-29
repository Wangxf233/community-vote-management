Page({
  data: {
    id: "",
    detailData: null,
    loading: true,
    isGuest: false,
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
    const bindingStatus = getApp().globalData.bindingStatus || "none";
    if (bindingStatus === "guest") {
      this.setData({ isGuest: true });
      this.loadGuestDetail(id);
      return;
    }

    this.loadDetailData(id);
  },

  loadGuestDetail(id) {
    const detailMap = {
      "guest-notice-1": {
        _id: "guest-notice-1",
        title: "关于清明节前园区安全巡查的通知",
        publisher: "物业公司",
        publishTime: "2026-03-17 09:00",
        content:
          "为保障节前小区安全，物业将于3月20日至3月22日开展公共区域安全巡查，重点检查消防设施、地下车库与电梯机房。请业主配合保持消防通道畅通。",
        attachments: [
          {
            name: "巡查安排表.pdf",
            type: "doc",
            url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          },
        ],
      },
      "guest-notice-2": {
        _id: "guest-notice-2",
        title: "地下车库照明分区检修公告",
        publisher: "物业公司",
        publishTime: "2026-03-16 14:20",
        content:
          "3月19日10:00-16:00将对B1、B2部分照明线路进行分区检修。检修期间请车主减速慢行，服从现场指引。",
        attachments: [],
      },
      "guest-notice-3": {
        _id: "guest-notice-3",
        title: "2026年第一季度物业服务质量回访安排",
        publisher: "业委会",
        publishTime: "2026-03-14 18:30",
        content:
          "客服管家将按楼栋开展入户回访，重点收集环境保洁、工程维修、秩序维护等方面意见，并形成整改清单。",
        attachments: [],
      },
      "guest-committee-1": {
        _id: "guest-committee-1",
        title: "业委会关于公共收益季度公示的说明",
        publisher: "星河苑业主委员会",
        publishTime: "2026-03-15 10:00",
        content:
          "现对2026年第一季度公共收益收支情况进行公示，主要包括场地租赁收益、广告位收益及公共维修支出。公示期为7天。",
        attachments: [],
      },
      "guest-property-1": {
        _id: "guest-property-1",
        title: "春季绿化养护及病虫害防治安排",
        publisher: "星河苑物业服务中心",
        publishTime: "2026-03-14 15:30",
        content:
          "3月下旬将集中开展绿化修剪、补植和病虫害防治作业，施工时段为9:00-17:00，请过往业主注意安全。",
        attachments: [],
      },
      "guest-laws-1": {
        _id: "guest-laws-1",
        title: "《民法典》物业服务相关条款解读",
        publisher: "社区法务顾问",
        publishTime: "2026-03-12 09:20",
        content:
          "本次解读围绕物业服务合同、公共收益归属、维修资金使用程序等条款，帮助业主依法维护自身权益。",
        attachments: [],
      },
    };

    const data = detailMap[id] || {
      _id: id,
      title: "公告详情",
      publisher: "星河苑物业服务中心",
      publishTime: "2026-03-10 10:00",
      content: "该公告内容为游客演示数据。",
      attachments: [],
    };

    this.setData({
      detailData: data,
      loading: false,
    });

    wx.setNavigationBarTitle({
      title: data.title || "信息详情",
    });
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
    if (this.data.isGuest) {
      this.loadGuestDetail(this.data.id);
    } else {
      this.loadDetailData(this.data.id);
    }
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },
});
