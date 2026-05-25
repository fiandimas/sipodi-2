import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/types/role";

import { getSession, type SessionPayload } from "@/app/_lib/session";
import { mapRoleToUiRole } from "@/app/_lib/role-map";

type RequireOptions = {
  loginPath?: string; // default: /auth/login
  unauthorizedPath?: string; // default: /dashboard
};

export async function requireSession(
  opts: RequireOptions = {}
): Promise<SessionPayload> {
  const loginPath = opts.loginPath ?? "/auth/login";

  const session = await getSession();
  if (!session) redirect(loginPath);

  return session;
}

export async function requireUiRole(
  allowed: UserRole[],
  opts: RequireOptions = {}
): Promise<{ session: SessionPayload; uiRole: UserRole }> {
  const unauthorizedPath = opts.unauthorizedPath ?? "/dashboard";

  const session = await requireSession(opts);
  const uiRole = mapRoleToUiRole(session.role);

  if (!allowed.includes(uiRole)) {
    redirect(unauthorizedPath);
  }

  return { session, uiRole };
}
