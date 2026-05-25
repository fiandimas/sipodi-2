import * as XLSX from "xlsx";
import type { UserRole } from "@prisma/client";

export type UserExportRow = {
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  gtkName: string | null;
  schoolName: string | null;
  branchName: string | null;
};

const ROLE_ALIAS: Record<string, string> = {
  USER_GTK: "GTK",
  ADMIN_SEKOLAH: "Admin Sekolah",
  ADMIN_TALENTA: "Admin Talenta",
  SUPER_ADMIN: "Super Admin",
};

function xlsRoleLabel(role: string): string {
  const key = role.replaceAll(" ", "_").toUpperCase();
  return ROLE_ALIAS[key] ?? role;
}

export function exportUsersToXLS(data: UserExportRow[]) {
  const worksheet = XLSX.utils.json_to_sheet(
    data.map((u) => ({
      Username: u.username,
      Nama: u.name,
      Role: xlsRoleLabel(u.role),
      Status: u.isActive ? "Aktif" : "Nonaktif",
      GTK: u.gtkName ?? "-",
      Sekolah: u.schoolName ?? "-",
      Cabang: u.branchName ?? "-",
    })),
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data User");

  XLSX.writeFile(workbook, "data-user.xlsx");
}
