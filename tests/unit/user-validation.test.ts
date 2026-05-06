import { describe, it, expect } from "vitest";
import {
  validateUsername, validateDisplayName, validatePassword,
  USERNAME_RE, DISPLAY_NAME_MAX, PASSWORD_MIN, PASSWORD_MAX,
} from "@/lib/user-validation";

describe("validateUsername", () => {
  it("alice → ok", () => { expect(validateUsername("alice").ok).toBe(true); });
  it("a_l_1 → ok", () => { expect(validateUsername("a_l_1").ok).toBe(true); });
  it("ALICE → ok（大小写都允许）", () => { expect(validateUsername("ALICE").ok).toBe(true); });
  it("ab → 太短", () => { expect(validateUsername("ab").ok).toBe(false); });
  it("31 字符 → 太长", () => { expect(validateUsername("a".repeat(31)).ok).toBe(false); });
  it("中文不允许", () => { expect(validateUsername("张三abc").ok).toBe(false); });
  it("空格不允许", () => { expect(validateUsername("a l").ok).toBe(false); });
  it("emoji 不允许", () => { expect(validateUsername("🍎abc").ok).toBe(false); });
  it("空字符串", () => { expect(validateUsername("").ok).toBe(false); });
  it("USERNAME_RE 正则导出", () => {
    expect(USERNAME_RE.test("alice")).toBe(true);
    expect(USERNAME_RE.test("ab")).toBe(false);
  });
});

describe("validateDisplayName", () => {
  it("Alice → ok", () => { expect(validateDisplayName("Alice").ok).toBe(true); });
  it("中文/emoji ok", () => { expect(validateDisplayName("张三 🍎").ok).toBe(true); });
  it("空 → 失败", () => { expect(validateDisplayName("").ok).toBe(false); });
  it("trim 空白 → 失败", () => { expect(validateDisplayName("  ").ok).toBe(false); });
  it(`> ${DISPLAY_NAME_MAX} 字 → 失败`, () => {
    expect(validateDisplayName("a".repeat(DISPLAY_NAME_MAX + 1)).ok).toBe(false);
  });
});

describe("validatePassword", () => {
  it(`${PASSWORD_MIN} 字符通过`, () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN)).ok).toBe(true);
  });
  it(`${PASSWORD_MIN - 1} 字符失败`, () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN - 1)).ok).toBe(false);
  });
  it(`${PASSWORD_MAX + 1} 字符失败`, () => {
    expect(validatePassword("a".repeat(PASSWORD_MAX + 1)).ok).toBe(false);
  });
  it("空失败", () => { expect(validatePassword("").ok).toBe(false); });
});
