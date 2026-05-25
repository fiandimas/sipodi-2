import type { ReactNode } from "react";
import { requireUiRole } from "@/app/_lib/require-role";

export default async function UserGtkLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUiRole(["user"], {
    loginPath: "/auth/login",
    unauthorizedPath: "/dashboard",
  });

  return children;
}
