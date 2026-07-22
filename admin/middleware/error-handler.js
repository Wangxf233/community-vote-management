/**
 * 全局错误处理中间件
 *
 * 使用方式（server.js）：
 *   const { errorHandler } = require("./middleware/error-handler");
 *   app.use(errorHandler);  // 在所有路由之后注册
 */

const { AppError } = require("../../shared/error-codes");

/**
 * 全局错误处理中间件
 * - AppError: 使用预定义的错误码和状态码
 * - 其他 Error: 返回 500 + 通用错误信息（不暴露内部细节）
 */
function errorHandler(err, req, res, _next) {
  // 已知的应用错误
  if (err instanceof AppError) {
    return res.status(err.httpStatus).json({
      success: false,
      error: err.code,
    });
  }

  // Joi/Zod 校验错误（格式适配）
  if (err.name === "ValidationError" || err.issues) {
    return res.status(400).json({
      success: false,
      error: "validation_error",
      details: err.issues || err.details,
    });
  }

  // 未知错误 — 记录完整错误但不暴露给客户端
  console.error("[ErrorHandler]", err.message, err.stack);

  return res.status(500).json({
    success: false,
    error: "internal_error",
  });
}

/**
 * 404 处理中间件
 */
function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    error: "resource_not_found",
  });
}

module.exports = { errorHandler, notFoundHandler };
