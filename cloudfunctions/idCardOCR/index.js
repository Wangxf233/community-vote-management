// 云函数：身份证OCR识别
const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

// 引入腾讯云SDK（需要安装 tencentcloud-sdk-nodejs）
// npm install tencentcloud-sdk-nodejs --save

const tencentcloud = require("tencentcloud-sdk-nodejs");
const OcrClient = tencentcloud.ocr.v20181119.Client;

exports.main = async (event, context) => {
  const { imageUrl, cardSide } = event; // cardSide: 'FRONT' 或 'BACK'

  try {
    // 配置腾讯云OCR客户端
    const clientConfig = {
      credential: {
        secretId: process.env.TENCENT_SECRET_ID,
        secretKey: process.env.TENCENT_SECRET_KEY,
      },
      region: "ap-guangzhou",
      profile: {
        httpProfile: {
          endpoint: "ocr.tencentcloudapi.com",
        },
      },
    };

    const client = new OcrClient(clientConfig);

    // 下载云存储图片
    const res = await cloud.downloadFile({
      fileID: imageUrl,
    });

    // 将图片转为base64
    const imageBase64 = res.fileContent.toString("base64");

    // 调用身份证识别API
    const params = {
      ImageBase64: imageBase64,
      CardSide: cardSide, // FRONT-正面 BACK-反面
      Config: JSON.stringify({
        CropIdCard: true, // 是否裁剪身份证
        CropPortrait: false, // 是否裁剪头像
        CopyWarn: true, // 是否检测复印件告警
        BorderCheckWarn: true, // 是否检测边框不完整告警
        ReshootWarn: true, // 是否检测翻拍告警
        DetectPsWarn: true, // 是否检测PS告警
        TempIdWarn: true, // 是否检测临时身份证告警
        InvalidDateWarn: true, // 是否检测有效日期不合法告警
        Quality: true, // 是否开启图片质量分数
        MultiCardDetect: true, // 是否开启多卡证检测
      }),
    };

    const ocrResult = await client.IDCardOCR(params);

    // 解析结果
    let result = {
      success: true,
      data: {},
      warnings: [],
      quality: null,
    };

    if (cardSide === "FRONT") {
      // 正面信息
      result.data = {
        name: ocrResult.Name,
        sex: ocrResult.Sex,
        nation: ocrResult.Nation,
        birth: ocrResult.Birth,
        address: ocrResult.Address,
        idNum: ocrResult.IdNum,
      };
    } else {
      // 反面信息
      result.data = {
        authority: ocrResult.Authority,
        validDate: ocrResult.ValidDate,
      };
    }

    // 质量分数
    if (ocrResult.Quality) {
      result.quality = ocrResult.Quality;
    }

    // 检查各种告警
    const warnings = [];
    if (ocrResult.AdvancedInfo) {
      const advInfo = JSON.parse(ocrResult.AdvancedInfo);

      if (advInfo.WarnInfos) {
        advInfo.WarnInfos.forEach((warn) => {
          warnings.push(warn);
        });
      }
    }

    result.warnings = warnings;

    // 判断图片是否合格
    const qualityThreshold = 50; // 质量分数阈值
    if (result.quality && result.quality < qualityThreshold) {
      result.success = false;
      result.message = `图片质量较低（${result.quality}分），请重新拍摄`;
    }

    if (warnings.length > 0) {
      result.success = false;
      result.message = "检测到以下问题：" + warnings.join("、");
    }

    return result;
  } catch (error) {
    console.error("OCR识别失败:", error);
    return {
      success: false,
      message: error.message || "识别失败，请重试",
      error: error,
    };
  }
};
