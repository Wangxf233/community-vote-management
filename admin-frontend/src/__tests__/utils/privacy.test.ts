import { describe, it, expect } from "vitest";
import { maskPhone, maskIdCard, maskName, maskAddress } from "@shared/privacy";

describe("maskPhone", () => {
  it("should mask middle 4 digits of 11-digit phone", () => {
    expect(maskPhone("13812345678")).toBe("138****5678");
  });

  it("should handle short phone number", () => {
    expect(maskPhone("123456")).toBe("123456");
  });

  it("should handle empty string", () => {
    expect(maskPhone("")).toBe("");
  });

  it("should handle null/undefined", () => {
    expect(maskPhone(null as any)).toBe("");
    expect(maskPhone(undefined as any)).toBe("");
  });
});

describe("maskIdCard", () => {
  it("should mask middle 10 digits of 18-digit ID card", () => {
    expect(maskIdCard("330102199001011234")).toBe("3301**********1234");
  });

  it("should handle short ID card", () => {
    expect(maskIdCard("3301021990")).toBe("3301021990");
  });

  it("should handle empty string", () => {
    expect(maskIdCard("")).toBe("");
  });
});

describe("maskName", () => {
  it("should mask all but first character for 2-char name", () => {
    expect(maskName("张三")).toBe("张*");
  });

  it("should mask all but first character for 3-char name", () => {
    expect(maskName("张三丰")).toBe("张**");
  });

  it("should handle single character", () => {
    expect(maskName("张")).toBe("张");
  });

  it("should handle empty string", () => {
    expect(maskName("")).toBe("");
  });
});

describe("maskAddress", () => {
  it("should keep only province and city at level 2", () => {
    const result = maskAddress("浙江省 杭州市 西湖区 某某路 123号", 2);
    expect(result).toContain("浙江省");
    expect(result).toContain("杭州市");
    expect(result).toContain("***");
    expect(result).not.toContain("某某路");
  });

  it("should return *** at level 0", () => {
    expect(maskAddress("浙江省杭州市", 0)).toBe("***");
  });

  it("should handle empty address", () => {
    expect(maskAddress("", 2)).toBe("");
  });
});
