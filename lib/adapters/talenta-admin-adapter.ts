import type { Talenta } from "@/lib/types/talenta";
import type { TalentaAdmin } from "@/lib/types/talenta-admin";

export function mapTalentaToAdmin(t: Talenta): TalentaAdmin {
  return {
    id: t.id,
    status: t.status,

    // ✅ BARU
    jumlahTalentaGtk: t.jumlahTalentaGtk ?? 0,

    skorUser: t.skorUser,
    skorTag: t.skorTag,
    skorJenis: t.skorJenis,
    skorAdmin: t.skorAdmin,
    totalSkor: t.totalSkor,

    gtk: {
      nik: t.gtk.nik,
      nama: t.gtk.nama,
      sekolah: t.gtk.sekolah,
      fotoUrl: t.gtk.fotoUrl ?? null,
    },

    // decision meta
    approvedAt: t.approvedAt ?? null,
    approvedBy: t.approvedBy ?? null,
    approvedScope: t.approvedScope ?? null,
    approvalNote: t.approvalNote ?? null,

    rejectedAt: t.rejectedAt ?? null,
    rejectedBy: t.rejectedBy ?? null,
    rejectedScope: t.rejectedScope ?? null,
    rejectedScopeResolved: t.rejectedScopeResolved ?? t.rejectedScope ?? null,
    rejectionNote: t.rejectionNote ?? null,

    detailTalenta: t.detailTalenta.map((d) => ({
      id: d.id,
      namaKegiatan: d.namaKegiatan,
      penyelenggara: d.penyelenggara,

      bidang: d.bidang,
      kategori: d.kategori,
      subKategori: d.subKategori,

      tag: d.tag,
      deskripsi: d.deskripsi,

      tanggalMulai: d.tanggalMulai,
      durasiHari: d.durasiHari,

      buktiUrl: d.buktiUrl,
      linkPendukung: d.linkPendukung,

      // otomatis: nilai sistem (jenis + tag)
      skorOtomatis: (d.jenisScore ?? 0) + (d.tagScore ?? 0),
      skorAdmin: d.adminScore ?? 0,
    })),
  };
}
