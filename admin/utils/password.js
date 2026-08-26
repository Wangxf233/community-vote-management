/**
 * 密码哈希工具 — bcrypt 加盐哈希
 *
 * 兼容旧版裸 SHA-256 哈希：
 * - verifyPassword 返回 { valid, needsUpgrade }
 * - needsUpgrade=true 表示密码正确但仍是旧格式，调用方应调用 upgradePasswordHash 更新
 */

const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const BCRYPT_ROUNDS = 10;

/**
 * 计算新密码的 bcrypt 哈希
 */
function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

/**
 * 校验密码（兼容旧版裸 SHA-256）
 * @param {string} password 明文密码
 * @param {object} user 用户文档（含 passwordHash，可能含 passwordSalt）
 * @returns {{ valid: boolean, needsUpgrade: boolean }}
 */
function verifyPassword(password, user) {
  if (!user || !user.passwordHash) {
    return { valid: false, needsUpgrade: false };
  }

  // 新格式：bcrypt（$2a$/$2b$/$2y$ 开头）
  if (user.passwordHash.startsWith("$2")) {
    let valid = false;
    try {
      valid = bcrypt.compareSync(password, user.passwordHash);
    } catch (e) {
      console.error("bcrypt 校验失败:", e.message);
      return { valid: false, needsUpgrade: false };
    }
    return { valid, needsUpgrade: false };
  }

  // 旧格式：裸 SHA-256（无盐）—— 兼容校验，校验通过后提示升级
  const legacyHash = crypto.createHash("sha256").update(password).digest("hex");
  const valid = legacyHash === user.passwordHash;
  return { valid, needsUpgrade: valid };
}

module.exports = { hashPassword, verifyPassword };
