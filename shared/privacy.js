/**
 * 统一隐私数据脱敏工具库 — Node.js / 云函数 版本
 *
 * 使用示例：
 *   const { maskPhone, maskIdCard, maskName } = require("../../shared/privacy");
 *   console.log(maskPhone("13812345678")); // "138****5678"
 */

/**
 * 手机号脱敏：前3后4，中间4位掩码
 * @param {string} phone - 原始手机号
 * @returns {string} 脱敏后手机号
 */
function maskPhone(phone) {
  if (!phone || typeof phone !== "string") return phone || "";
  if (phone.length < 7) return phone; // 不足7位不脱敏
  return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
}

/**
 * 身份证号脱敏：前4后4，中间10位掩码
 * @param {string} idCard - 原始身份证号
 * @returns {string} 脱敏后身份证号
 */
function maskIdCard(idCard) {
  if (!idCard || typeof idCard !== "string") return idCard || "";
  if (idCard.length < 15) return idCard; // 不足15位不脱敏
  return idCard.replace(/(\d{4})\d{10}(\d{4})/, "$1**********$2");
}

/**
 * 姓名脱敏：保留首字，其余掩码
 * @param {string} name - 原始姓名
 * @returns {string} 脱敏后姓名，如 "张**" 或 "张***"
 */
function maskName(name) {
  if (!name || typeof name !== "string") return name || "";
  if (name.length <= 1) return name;
  return name[0] + "*".repeat(name.length - 1);
}

/**
 * 地址脱敏：按保留层级截断
 * @param {string} address - 完整地址
 * @param {number} keepLevel - 保留层级: 1=省, 2=市, 3=区, 0=全部隐藏
 * @returns {string} 脱敏后地址
 */
function maskAddress(address, keepLevel) {
  if (!address || typeof address !== "string") return address || "";
  if (keepLevel === 0) return "***";
  if (!keepLevel || keepLevel >= 3) return address; // 保留全部
  // 简单按空格/逗号分隔，保留前 keepLevel 段
  const parts = address.split(/[\s,，]+/).filter(Boolean);
  const kept = parts.slice(0, keepLevel).join(" ");
  return kept + (parts.length > keepLevel ? " ***" : "");
}

/**
 * 日志用手机号脱敏（更安全，不保留完整前3后4）
 * @param {string} phone
 * @returns {string}
 */
function maskPhoneForLog(phone) {
  if (!phone || typeof phone !== "string") return phone || "";
  if (phone.length < 7) return "***";
  return phone.slice(0, 3) + "****" + phone.slice(-2);
}

module.exports = {
  maskPhone,
  maskIdCard,
  maskName,
  maskAddress,
  maskPhoneForLog,
};
