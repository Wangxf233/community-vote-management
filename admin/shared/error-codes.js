/**
 * 统一错误码体系 — admin 内联副本（部署时 shared/ 不可用）
 */

const ERROR_CODES = {
  TOKEN_MISSING: { code: "token_missing", httpStatus: 401, message: "请先登录" },
  TOKEN_INVALID: { code: "token_invalid", httpStatus: 401, message: "登录已过期，请重新登录" },
  TOKEN_EXPIRED: { code: "token_expired", httpStatus: 401, message: "登录已过期" },
  INSUFFICIENT_PERMISSIONS: { code: "insufficient_permissions", httpStatus: 403, message: "权限不足" },
  COMMUNITY_EXPIRED: { code: "community_expired", httpStatus: 403, message: "小区服务已到期，请联系管理员续费" },
  CROSS_COMMUNITY_ACCESS: { code: "cross_community_access", httpStatus: 403, message: "无权访问其他小区数据" },
  VALIDATION_ERROR: { code: "validation_error", httpStatus: 400, message: "参数校验失败" },
  MISSING_PARAMS: { code: "missing_params", httpStatus: 400, message: "缺少必要参数" },
  INVALID_FORMAT: { code: "invalid_format", httpStatus: 400, message: "参数格式不正确" },
  RESOURCE_NOT_FOUND: { code: "resource_not_found", httpStatus: 404, message: "请求的资源不存在" },
  RESOURCE_CONFLICT: { code: "resource_conflict", httpStatus: 409, message: "资源已存在，无法重复创建" },
  RESOURCE_ALREADY_EXISTS: { code: "resource_already_exists", httpStatus: 409, message: "资源已存在" },
  INTERNAL_ERROR: { code: "internal_error", httpStatus: 500, message: "服务器内部错误" },
  SERVICE_UNAVAILABLE: { code: "service_unavailable", httpStatus: 503, message: "服务暂不可用，请稍后重试" },
  DATABASE_ERROR: { code: "database_error", httpStatus: 500, message: "数据库操作失败" },
};

class AppError extends Error {
  constructor(errorCode, detail = null) {
    super(errorCode.message);
    this.code = errorCode.code;
    this.httpStatus = errorCode.httpStatus;
    this.detail = detail;
  }
}

module.exports = { ERROR_CODES, AppError };
