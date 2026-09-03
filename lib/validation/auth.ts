import { z } from "zod";

/**
 * Auth form contracts. api-specification.md §5 · AUTH-02 / AUTH-03 / AUTH-04.
 *
 * MVP scope (Decision D2 / D5 — no SMS provider):
 *  - Sign up and log in use EMAIL + password only.
 *  - "Mobile" on the sign-up form is an optional contact field stored on the
 *    profile; it is not a login credential.
 *  - Role is chosen at sign-up and is immutable (AUTH-001). ADMIN is never
 *    selectable — the DB trigger downgrades it anyway, this is belt-and-braces.
 */

export const SIGNUP_ROLES = ["VIEWER", "PUBLISHER"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

/** +91XXXXXXXXXX or a bare 10-digit Indian mobile. Optional everywhere. */
const indianMobile = z
  .string()
  .trim()
  .regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long"); // bcrypt hard limit

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    role: z.enum(SIGNUP_ROLES, {
      // rejects "ADMIN" and anything else before we ever call signUp
      message: "Choose whether you want to advertise or list hoardings",
    }),
    full_name: z.string().trim().min(2, "Enter your name").max(120),
    business_name: z.string().trim().max(160).optional().or(z.literal("")),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    phone: indianMobile.optional().or(z.literal("")),
    password: passwordSchema,
  })
  .refine(
    (v) => v.role !== "PUBLISHER" || (v.business_name?.trim().length ?? 0) > 0,
    {
      path: ["business_name"],
      message: "Business name is required for publishers",
    },
  );
export type SignupInput = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

/** Normalise an Indian mobile to E.164 for storage. "" -> undefined. */
export function normaliseMobile(
  raw: string | undefined | null,
): string | undefined {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  const digits = s.replace(/\D/g, "");
  const ten = digits.slice(-10);
  return ten.length === 10 ? `+91${ten}` : undefined;
}

/** Cheap client-side hint for the login field (currently email-only). */
export function looksLikeEmail(s: string): boolean {
  return /\S+@\S+\.\S+/.test(s.trim());
}

/** Very rough password-strength score 0..4 for the live meter on AUTH-03. */
export function passwordStrength(pw: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const s = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  return {
    score: s,
    label: ["Very weak", "Weak", "Fair", "Good", "Strong"][s],
  };
}
