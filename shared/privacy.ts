/**
 * 统一隐私数据脱敏工具库 — TypeScript 版本（管理前端使用）
 *
 * 使用示例：
 *   import { maskPhone, maskIdCard } from "@shared/privacy";
 *   const displayPhone = maskPhone(user.phone); // "138****5678"
 */

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone || "";
  return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
}

export function maskIdCard(idCard: string): string {
  if (!idCard || idCard.length < 15) return idCard || "";
  return idCard.replace(/(\d{4})\d{10}(\d{4})/, "$1**********$2");
}

export function maskName(name: string): string {
  if (!name || name.length <= 1) return name || "";
  return name[0] + "*".repeat(name.length - 1);
}

export function maskAddress(address: string, keepLevel: number = 2): string {
  if (!address) return address || "";
  if (keepLevel === 0) return "***";
  if (keepLevel >= 3) return address;
  const parts = address.split(/[\s,，]+/).filter(Boolean);
  const kept = parts.slice(0, keepLevel).join(" ");
  return kept + (parts.length > keepLevel ? " ***" : "");
}
