import "server-only";
import { z } from "zod";
import { clientEnv } from "@/lib/env";

/**
 * Server-only environment. NEVER import this into a Client Component.
 * Validated once at module load on the server.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_PROJECT_REF: z.string().optional().default(""),
  REQUEST_SLA_HOURS: z.coerce.number().int().positive().default(48),
  REQUEST_EXPIRING_SOON_HOURS: z.coerce.number().int().positive().default(6),
  MEDIA_MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
  MEDIA_MIN_PHOTOS_TO_SUBMIT: z.coerce.number().int().positive().default(3),
  AUTH_OTP_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default(""),
  ADMIN_BOOTSTRAP_EMAIL: z.string().optional().default(""),
});

const parsed = serverSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid server environment:\n${parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n")}`,
  );
}

export const serverEnv = {
  ...parsed.data,
  ...clientEnv,
};
export type ServerEnv = typeof serverEnv;
