/**
 * 结构化日志 — 基于 pino
 *
 * 使用方式：
 *   const logger = require("../utils/logger");
 *   logger.info({ userId, action }, "用户操作描述");
 *   logger.error({ err, requestId }, "错误描述");
 *
 * 自动屏蔽敏感字段：phone, idCard, password, token, secret, authorization
 */

const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "phone",
      "idCard",
      "password",
      "passwordHash",
      "token",
      "secret",
      "authorization",
      "adminToken",
      "idCardFront",
      "idCardBack",
      "realNameIdCardFront",
      "realNameIdCardBack",
    ],
    censor: "[REDACTED]",
  },
  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

module.exports = logger;
