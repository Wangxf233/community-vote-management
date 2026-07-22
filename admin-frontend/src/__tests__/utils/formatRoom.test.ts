import { describe, it, expect } from "vitest";
import { formatRoom } from "@/utils/formatRoom";

describe("formatRoom", () => {
  it("should pad room number to 4 digits", () => {
    expect(formatRoom("1")).toBe("0001");
    expect(formatRoom("101")).toBe("0101");
    expect(formatRoom("1001")).toBe("1001");
  });

  it("should handle already padded room number", () => {
    expect(formatRoom("0101")).toBe("0101");
  });
});
