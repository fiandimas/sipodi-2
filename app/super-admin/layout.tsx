import type { ReactNode } from "react";
import { requireUiRole } from "@/app/_lib/require-role";

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUiRole(["super admin"], {
    loginPath: "/auth/login",
    unauthorizedPath: "/dashboard",
  });

  return children;
}
