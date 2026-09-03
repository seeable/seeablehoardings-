import { redirect } from "next/navigation";
import { getSessionUser, homePathForRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Tiny server-only hop: middleware bounces a signed-in user here from the auth
 * pages; this reads the profile (which middleware can't) and sends them to their
 * role home. AUTH-03 / api-specification.md §5.11.
 */
export default async function PostLogin() {
  const user = await getSessionUser();
  redirect(user ? homePathForRole(user.role) : "/login");
}
