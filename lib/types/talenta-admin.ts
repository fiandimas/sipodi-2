import type { DecisionScope, SubmissionStatus, ReviewStatus } from "@/lib/types/talenta";

export interface GTKAdminProfile {
  nik: string;
  nama: string;
  sekolah: string;
  fotoUrl?: string | null;
}

export interface TalentaFileAdmin {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
}

export interface TalentaDetailAdmin {
  id: string;
  namaKegiatan: string;
  penyelenggara: string;

  jenis?: string;

  bidang: string;
  kategori: string;
  subKategori?: string;

  tag?: string[];
  deskripsi?: string;

  tanggalMulai?: string;
  durasiHari?: number;

  linkPendukung?: string;
  files?: TalentaFileAdmin[];

  skorOtomatis?: number;
  skorAdmin?: number;
}

export interface TalentaAdmin {
  id: string;
  gtk: GTKAdminProfile;

  status: SubmissionStatus;
  reviewStatus?: ReviewStatus;

  jumlahTalentaGtk?: number;

  skorUser: number;
  skorTag: number;
  skorJenis: number;
  skorAdmin: number;
  totalSkor: number;

  // ==== decision meta ====
  approvedAt?: string | null;
  approvedBy?: string | null;
  approvedScope?: DecisionScope | null;

  // ✅ taruh di sini (untuk UI status 4-state)
  approvedScopeResolved?: DecisionScope | null;

  approvalNote?: string | null;

  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectedScope?: DecisionScope | null;

  // ✅ ini sebelumnya sudah ada di API Anda
  rejectedScopeResolved?: DecisionScope | null;

  rejectionNote?: string | null;

  detailTalenta: TalentaDetailAdmin[];
}
