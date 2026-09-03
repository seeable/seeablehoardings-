import { describe, expect, it } from "vitest";
import {
  loginSchema,
  signupSchema,
  resetPasswordSchema,
  normaliseMobile,
  looksLikeEmail,
  passwordStrength,
} from "@/lib/validation/auth";
import { computeGates } from "@/lib/auth/gates";

describe("signupSchema", () => {
  const base = {
    role: "VIEWER" as const,
    full_name: "Asha Rao",
    email: "Asha@Example.com",
    password: "correcthorse1!",
  };

  it("accepts a valid viewer and lowercases the email", () => {
    const r = signupSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("asha@example.com");
  });

  it("rejects role=ADMIN before signUp is ever called (AUTH-001)", () => {
    const r = signupSchema.safeParse({ ...base, role: "ADMIN" });
    expect(r.success).toBe(false);
  });

  it("requires a business name for publishers", () => {
    const noBiz = signupSchema.safeParse({ ...base, role: "PUBLISHER" });
    expect(noBiz.success).toBe(false);
    const withBiz = signupSchema.safeParse({
      ...base,
      role: "PUBLISHER",
      business_name: "Rao Outdoor",
    });
    expect(withBiz.success).toBe(true);
  });

  it("rejects a short password", () => {
    expect(
      signupSchema.safeParse({ ...base, password: "short1!" }).success,
    ).toBe(false);
  });

  it("rejects a malformed mobile but allows empty", () => {
    expect(signupSchema.safeParse({ ...base, phone: "12345" }).success).toBe(
      false,
    );
    expect(signupSchema.safeParse({ ...base, phone: "" }).success).toBe(true);
    expect(
      signupSchema.safeParse({ ...base, phone: "+919900000001" }).success,
    ).toBe(true);
  });
});

describe("loginSchema", () => {
  it("takes email + password", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
    expect(
      loginSchema.safeParse({ email: "not-an-email", password: "x" }).success,
    ).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("requires the two passwords to match", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "abcdefgh1",
        confirm: "abcdefgh1",
      }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        password: "abcdefgh1",
        confirm: "different",
      }).success,
    ).toBe(false);
  });
});

describe("helpers", () => {
  it("normaliseMobile -> E.164 or undefined", () => {
    expect(normaliseMobile("9900000001")).toBe("+919900000001");
    expect(normaliseMobile("+91 99000 00001")).toBe("+919900000001");
    expect(normaliseMobile("")).toBeUndefined();
    expect(normaliseMobile("123")).toBeUndefined();
  });

  it("looksLikeEmail", () => {
    expect(looksLikeEmail("x@y.com")).toBe(true);
    expect(looksLikeEmail("9900000001")).toBe(false);
  });

  it("passwordStrength scales 0..4", () => {
    expect(passwordStrength("abc").score).toBe(0);
    expect(passwordStrength("abcdefgh").score).toBeGreaterThanOrEqual(1);
    expect(passwordStrength("Abcdefgh12!x").score).toBe(4);
  });
});

describe("computeGates (api-spec §5.11)", () => {
  it("VIEWER: can request, cannot submit, no publisher fields", () => {
    const g = computeGates("VIEWER", null);
    expect(g).toMatchObject({
      can_create_requests: true,
      can_submit_listings: false,
      publisher_verification_status: null,
      publisher_suspended: false,
      otp_required: false,
    });
  });

  it("PUBLISHER unverified: cannot submit", () => {
    const g = computeGates("PUBLISHER", {
      verification_status: "UNVERIFIED",
      suspended: false,
    });
    expect(g.can_submit_listings).toBe(false);
    expect(g.publisher_verification_status).toBe("UNVERIFIED");
    expect(g.can_create_requests).toBe(false);
  });

  it("PUBLISHER verified + not suspended: can submit", () => {
    const g = computeGates("PUBLISHER", {
      verification_status: "VERIFIED",
      suspended: false,
    });
    expect(g.can_submit_listings).toBe(true);
  });

  it("PUBLISHER verified but suspended: cannot submit (ADMIN-002)", () => {
    const g = computeGates("PUBLISHER", {
      verification_status: "VERIFIED",
      suspended: true,
    });
    expect(g.can_submit_listings).toBe(false);
    expect(g.publisher_suspended).toBe(true);
  });

  it("ADMIN: no publisher gates, no request gate", () => {
    const g = computeGates("ADMIN", null);
    expect(g.can_submit_listings).toBe(false);
    expect(g.can_create_requests).toBe(false);
    expect(g.publisher_verification_status).toBeNull();
  });

  it("otpRequired override flows through", () => {
    expect(
      computeGates("VIEWER", null, { otpRequired: true }).otp_required,
    ).toBe(true);
  });
});
