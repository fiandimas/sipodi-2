import * as XLSX from "xlsx";
import type { TalentaSuperAdmin } from "@/lib/types/talenta-super-admin";

type UiStatus = "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED" | "DINILAI";

function uiStatusLabel(s: UiStatus) {
  if (s === "REJECTED") return "Ditinjau Ulang";
  if (s === "TERVERIFIKASI") return "Verifikasi";
  if (s === "DINILAI" || s === "APPROVED") return "Dinilai";
  return "Belum verifikasi";
}

function uiStatusOf(t: TalentaSuperAdmin): UiStatus {
  if (t.reviewStatus) return t.reviewStatus as UiStatus;

  if (t.status === "REJECTED") return "REJECTED";
  if (t.status === "PENDING") return "PENDING";

  const scope = t.approvedScopeResolved ?? t.approvedScope ?? null;
  if (scope === "SEKOLAH" || scope === null) return "TERVERIFIKASI";
  if (scope === "TALENTA" || scope === "SUPER_ADMIN") return "APPROVED";
  return "PENDING";
}

export function exportTalentaSuperAdminToXLS(data: TalentaSuperAdmin[]) {
  const rows = data.map((t, i) => {
    const d = Array.isArray(t.detailTalenta) ? t.detailTalenta[0] : undefined;

    const s = uiStatusOf(t);
    const statusLabel = uiStatusLabel(s);

    return {
      No: i + 1,
      GTK: t.gtk.nama,
      Sekolah: t.gtk.sekolah ?? "-",
      "Jenis Talenta": d?.namaKegiatan ?? "-",
      Skor: t.totalSkor ?? t.skorTalenta ?? d?.computedScore ?? 0,
      Status: statusLabel,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Talenta");
  XLSX.writeFile(wb, "data-talenta-super-admin.xlsx");
}
