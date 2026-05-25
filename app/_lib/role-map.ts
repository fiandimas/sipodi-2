// app/_lib/role-map.ts
import type { UserRole } from "@prisma/client";

export type UiRole =
  | "super admin"
  | "admin talenta"
  | "admin sekolah"
  | "user";

export function mapRoleToUiRole(role: UserRole): UiRole {
  switch (role) {
    case "SUPER_ADMIN":
      return "super admin";
    case "ADMIN_TALENTA":
      return "admin talenta";
    case "ADMIN_SEKOLAH":
      return "admin sekolah";
    case "USER_GTK":
    default:
      return "user";
  }
}
