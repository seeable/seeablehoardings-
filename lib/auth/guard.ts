import "server-only";
import { redirect } from "next/navigation";
import {
  getSessionUser,
  homePathForRole,
  type SessionUser,
} from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Tables"]["profiles"]["Row"]["role"];

/**
 * Server-side role guard for a route-group layout. No session -> /login;
 * wrong role -> silently to that role's own home (docs/07 §22 — never a 403
 * page for a mistyped URL). Returns the user for the layout to render.
 */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(homePathForRole(user.role));
  return user;
}
