import type { ReactNode } from "react";
import { requireUiRole } from "@/app/_lib/require-role";

export default async function AdminSekolahLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUiRole(["admin sekolah", "super admin"], {
    loginPath: "/auth/login",
    unauthorizedPath: "/dashboard",
  });

  return children;
}
