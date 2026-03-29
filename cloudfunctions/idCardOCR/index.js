// 云函数：身份证OCR识别（优化版）
const cloud = require("wx-server-sdk");
const tencentcloud = require("tencentcloud-sdk-nodejs");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const OcrClient = tencentcloud.ocr.v20181119.Client;

// 配置常量
const CONFIG = {
  // 质量阈值：低于此分数认为图片质量不合格
  QUALITY_THRESHOLD: 50,
  // 默认区域
  REGION: "ap-guangzhou",
  // OCR接口端点
  ENDPOINT: "ocr.tencentcloudapi.com",
};

// 告警码对应的中文描述
const WARNING_MESSAGES = {
  9102: "检测到复印件",
  9103: "检测到翻拍",
  9104: "边框不完整",
  9201: "检测到PS处理痕迹",
  9202: "临时身份证",
  9203: "身份证有效日期不合法",
  // 可以根据实际返回的告警码继续添加
};

// 自定义错误类
class OCRServiceError extends Error {
  constructor(message, code = "OCR_ERROR", details = null) {
    super(message);
    this.name = "OCRServiceError";
    this.code = code;
    this.details = details;
  }
}

exports.main = async (event, context) => {
  const { imageUrl, cardSide = "FRONT" } = event;

  // 参数验证
  if (!imageUrl) {
    throw new OCRServiceError("请提供图片fileID", "INVALID_PARAM");
  }

  if (!["FRONT", "BACK"].includes(cardSide)) {
    throw new OCRServiceError("cardSide参数必须是FRONT或BACK", "INVALID_PARAM");
  }

  try {
    // 1. 验证环境变量
    validateEnvironmentVariables();

    // 2. 初始化OCR客户端
    const client = initOCRClient();

    // 3. 下载并处理图片
    const imageBase64 = await downloadAndEncodeImage(imageUrl);

    // 4. 调用OCR接口
    const ocrResult = await callOCRAPI(client, imageBase64, cardSide);

    // 5. 解析和验证结果
    const processedResult = processOCRResult(ocrResult, cardSide);

    // 6. 添加调用日志（用于监控和调试）
    console.log("OCR调用成功:", {
      cardSide,
      quality: processedResult.quality,
      warningsCount: processedResult.warnings.length,
      success: processedResult.success,
    });

    return processedResult;
  } catch (error) {
    console.error("OCR识别失败:", {
      error: error.message,
      stack: error.stack,
      code: error.code,
      imageUrl,
      cardSide,
    });

    // 返回友好的错误信息
    return {
      success: false,
      message: getFriendlyErrorMessage(error),
      code: error.code || "UNKNOWN_ERROR",
      timestamp: Date.now(),
    };
  }
};

/**
 * 验证必要的环境变量
 */
function validateEnvironmentVariables() {
  const requiredEnvVars = ["TCB_SECRET_ID", "TCB_SECRET_KEY"];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    throw new OCRServiceError(
      `缺少必要的环境变量: ${missingVars.join(", ")}`,
      "ENV_MISSING",
    );
  }

  console.log("环境变量验证通过");
}

/**
 * 初始化OCR客户端
 */
function initOCRClient() {
  const clientConfig = {
    credential: {
      secretId: process.env.TCB_SECRET_ID,
      secretKey: process.env.TCB_SECRET_KEY,
    },
    region: CONFIG.REGION,
    profile: {
      httpProfile: {
        endpoint: CONFIG.ENDPOINT,
        // 设置超时时间（毫秒）
        reqTimeout: 30,
      },
    },
  };

  return new OcrClient(clientConfig);
}

/**
 * 下载云存储图片并转为base64
 */
async function downloadAndEncodeImage(fileID) {
  try {
    const res = await cloud.downloadFile({
      fileID: fileID,
    });

    if (!res.fileContent) {
      throw new OCRServiceError("图片下载失败", "DOWNLOAD_FAILED");
    }

    // 检查图片大小（可选，限制为5MB）
    const fileSize = res.fileContent.length;
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    if (fileSize > MAX_SIZE) {
      throw new OCRServiceError(
        `图片过大：${(fileSize / 1024 / 1024).toFixed(2)}MB，请压缩后重试`,
        "FILE_TOO_LARGE",
      );
    }

    return res.fileContent.toString("base64");
  } catch (error) {
    if (error instanceof OCRServiceError) {
      throw error;
    }
    throw new OCRServiceError(
      `图片处理失败: ${error.message}`,
      "IMAGE_PROCESS_ERROR",
    );
  }
}

/**
 * 调用OCR API
 */
async function callOCRAPI(client, imageBase64, cardSide) {
  // 配置OCR请求参数
  const params = {
    ImageBase64: imageBase64,
    CardSide: cardSide,
    Config: JSON.stringify({
      // 基础配置
      CropIdCard: true, // 裁剪身份证
      CropPortrait: false, // 不裁剪头像
      MultiCardDetect: true, // 多卡证检测

      // 质量检测配置
      CopyWarn: true, // 复印件告警
      BorderCheckWarn: true, // 边框不完整告警
      ReshootWarn: true, // 翻拍告警
      DetectPsWarn: true, // PS检测告警
      TempIdWarn: true, // 临时身份证告警
      InvalidDateWarn: true, // 有效期不合法告警
      Quality: true, // 图片质量分数
    }),
  };

  try {
    return await client.IDCardOCR(params);
  } catch (error) {
    console.error("OCR API调用失败:", error);

    // 处理腾讯云API错误
    if (error.code) {
      throw new OCRServiceError(
        getAPIErrorMessage(error.code),
        `API_${error.code}`,
        error,
      );
    }

    throw new OCRServiceError("OCR服务调用失败", "API_CALL_FAILED", error);
  }
}

/**
 * 处理OCR返回结果
 */
function processOCRResult(ocrResult, cardSide) {
  const result = {
    success: true,
    data: {},
    warnings: [],
    quality: null,
    rawData: ocrResult, // 保留原始数据供调试
    timestamp: Date.now(),
  };

  // 提取卡面信息
  if (cardSide === "FRONT") {
    result.data = {
      name: ocrResult.Name || "",
      sex: ocrResult.Sex || "",
      nation: ocrResult.Nation || "",
      birth: ocrResult.Birth || "",
      address: ocrResult.Address || "",
      idNum: ocrResult.IdNum || "",
    };

    // 验证必要字段是否识别成功
    const requiredFields = ["Name", "IdNum"];
    const missingFields = requiredFields.filter((field) => !ocrResult[field]);

    if (missingFields.length > 0) {
      result.warnings.push("关键信息识别不全，请确保身份证清晰");
    }
  } else {
    result.data = {
      authority: ocrResult.Authority || "",
      validDate: ocrResult.ValidDate || "",
    };
  }

  // 处理质量分数
  if (ocrResult.Quality) {
    result.quality = parseFloat(ocrResult.Quality);
  }

  // 处理告警信息
  const warnings = extractWarnings(ocrResult);
  result.warnings = [...result.warnings, ...warnings];

  // 判断图片是否合格
  validateImageQuality(result);

  return result;
}

/**
 * 提取告警信息
 */
function extractWarnings(ocrResult) {
  const warnings = [];

  if (ocrResult.AdvancedInfo) {
    try {
      const advInfo = JSON.parse(ocrResult.AdvancedInfo);

      if (advInfo.WarnInfos && Array.isArray(advInfo.WarnInfos)) {
        advInfo.WarnInfos.forEach((warnCode) => {
          const warnMessage =
            WARNING_MESSAGES[warnCode] || `未知告警(${warnCode})`;
          warnings.push({
            code: warnCode,
            message: warnMessage,
          });
        });
      }
    } catch (error) {
      console.error("解析AdvancedInfo失败:", error);
    }
  }

  return warnings;
}

/**
 * 验证图片质量
 */
function validateImageQuality(result) {
  // 质量分数检查
  if (result.quality !== null && result.quality < CONFIG.QUALITY_THRESHOLD) {
    result.success = false;
    result.message = `图片质量较低（${result.quality}分），请重新拍摄`;
    return;
  }

  // 告警检查
  if (result.warnings.length > 0) {
    result.success = false;

    // 生成友好的错误消息
    const warningMessages = result.warnings
      .map((w) => (typeof w === "string" ? w : w.message))
      .join("、");

    result.message = `检测到以下问题：${warningMessages}`;
    return;
  }

  // 如果通过所有检查
  if (result.success) {
    result.message = "身份证识别成功";
  }
}

/**
 * 获取友好的错误信息
 */
function getFriendlyErrorMessage(error) {
  const errorMessages = {
    ENV_MISSING: "服务配置错误，请联系管理员",
    DOWNLOAD_FAILED: "图片下载失败，请重试",
    FILE_TOO_LARGE: "图片过大，请压缩后重试",
    IMAGE_PROCESS_ERROR: "图片处理失败，请重试",
    API_CALL_FAILED: "OCR服务暂时不可用，请稍后重试",
    API_ResourceNotFound: "图片资源不存在",
    API_UnsupportedOperation: "不支持的图片格式",
    API_FailedOperation: "图片识别失败，请确保图片清晰",
  };

  return errorMessages[error.code] || error.message || "识别失败，请重试";
}

/**
 * 获取API错误码对应的中文提示
 */
function getAPIErrorMessage(errorCode) {
  const apiErrorMessages = {
    ResourceNotFound: "图片资源不存在",
    UnsupportedOperation: "不支持的图片格式",
    FailedOperation: "图片识别失败，请确保图片清晰",
    AuthFailure: "身份验证失败，请联系管理员",
    InvalidParameter: "请求参数错误",
    LimitExceeded: "超出调用限制，请稍后重试",
  };

  return apiErrorMessages[errorCode] || `OCR服务错误(${errorCode})`;
}
