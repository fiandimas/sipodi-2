import * as XLSX from "xlsx";
import type { Talenta } from "@/lib/types/talenta";
import type { TalentaAdmin } from "@/lib/types/talenta-admin";

type AnyTalentaForExport = Talenta | TalentaAdmin;
type ShownStatus = "PENDING" | "APPROVED" | "REJECTED" | "DINILAI" | "DITINJAU ULANG";

function getDetail(t: AnyTalentaForExport) {
  const d: any = (t as any).detailTalenta?.[0];
  return d ?? null;
}

function getGtk(t: AnyTalentaForExport) {
  const g: any = (t as any).gtk ?? null;
  return g ?? null;
}

function getTalentaCount(t: AnyTalentaForExport): number {
  const x: any = t;
  if (typeof x.jumlahTalentaGtk === "number") return x.jumlahTalentaGtk;
  return 0;
}

function getGtkKey(t: AnyTalentaForExport): string {
  const gtk: any = getGtk(t) ?? {};
  return String(
    gtk.nik ??
    gtk.nikGtk ??
    gtk.NIK ??
    (t as any).gtkNik ??
    gtk.nama ??
    (t as any).id ??
    "UNKNOWN"
  );
}

function getShownStatus(t: AnyTalentaForExport): ShownStatus {
  const reviewStatus = (t as any).reviewStatus as
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "DINILAI"
    | undefined;

  // kalau API sudah pakai reviewStatus 4–state
  if (reviewStatus === "REJECTED") return "DITINJAU ULANG";
  if (reviewStatus === "DINILAI") return "DINILAI";
  if (reviewStatus === "APPROVED") return "APPROVED";

  // kasus sekolah: TERVERIFIKASI di data, tapi export mau tulis APPROVED
  const uiStatus = (t as any).reviewStatus as
    | "TERVERIFIKASI"
    | "PENDING"
    | "APPROVED"
    | "DITINJAU ULANG"
    | "DINILAI"
    | undefined;

  if (uiStatus === "TERVERIFIKASI") return "APPROVED";

  // fallback lama pakai status submission
  const s = (t as any).status as "PENDING" | "APPROVED" | "REJECTED" | undefined;
  if (s === "REJECTED") return "DITINJAU ULANG";
  if (s === "APPROVED") return "APPROVED";
  return "PENDING";
}

/**
 * Skor final untuk 1 data talenta/submission.
 * Prioritas:
 * - totalSkor (format admin-talenta/super-admin baru)
 * - computedScore (langsung dari submission)
 * - skorTalenta (legacy)
 */
function getScore(t: AnyTalentaForExport): number {
  const x: any = t as any;
  if (typeof x.totalSkor === "number") return x.totalSkor;
  if (typeof x.computedScore === "number") return x.computedScore;
  if (typeof x.skorTalenta === "number") return x.skorTalenta;
  return 0;
}

function getShownStatusLabel(t: AnyTalentaForExport): string {
  const s = getShownStatus(t);

  if (s === "REJECTED") return "Ditolak";
  if (s === "DINILAI") return "Dinilai";
  if (s === "APPROVED") return "Verifikasi";
  return "Belum Verifikasi";
}

export function exportTalentaToXLS(data: AnyTalentaForExport[]) {
  const countMap = new Map<string, number>();

  for (const t of data) {
    const key = getGtkKey(t);
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  const rows = data.map((t, i) => {
    const d = getDetail(t);
    const gtk: any = getGtk(t);
    const key = getGtkKey(t);

    return {
      No: i + 1,
      "GTK Nama": gtk?.nama ?? "-",
      "GTK NIK": gtk?.nik ?? gtk?.nikGtk ?? gtk?.NIK ?? (t as any).gtkNik ?? "-",
      Sekolah: gtk?.sekolah ?? "-",

      Jenis: d?.jenis ?? "-",
      Bidang: d?.bidang ?? "-",
      Kategori: d?.kategori ?? "-",
      "Sub Kategori": d?.subKategori ?? "-",
      "Nama Kegiatan": d?.namaKegiatan ?? "-",

      "Jumlah Talenta": getTalentaCount(t),
      Skor: getScore(t),
      Status: getShownStatus(t),
    };
  });
  console.log("sample keys", data.slice(0, 10).map(getGtkKey));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Talenta");
  XLSX.writeFile(wb, "data-talenta.xlsx");
}