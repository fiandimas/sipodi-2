export type ReviewStatus = "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED" | "DINILAI" | "BELUM DINILAI";
export type DecisionScope = "SEKOLAH" | "TALENTA" | "SUPER_ADMIN";

export type DbStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface GTKSuperAdminProfile {
  nik: string;
  nama: string;
  sekolah: string;
  fotoUrl: string | null;
}

export interface TalentaFileSuperAdmin {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
}

export interface DetailTalentaSuperAdmin {
  id: string;
  namaKegiatan: string;
  penyelenggara: string;
  deskripsi: string;

  jenis: string;
  bidang: string;
  kategori: string;
  subKategori?: string;
  tag: string[];

  linkPendukung?: string;
  files?: TalentaFileSuperAdmin[];

  userScore?: number;
  jenisScore?: number;
  adminScore?: number;
  computedScore?: number;
  tagScore?: number;
  tagCount?: number;
}

export interface TalentaSuperAdmin {
  id: string;

  gtk: GTKSuperAdminProfile;

  // ✅ status dari DB
  status: DbStatus;

  // ✅ status kerja untuk UI super admin
  // sekarang 4-state: PENDING/TERVERIFIKASI/APPROVED/REJECTED
  reviewStatus: ReviewStatus;

  jenis: string;

  jumlahTalentaGtk: number;

  // skor
  skorTalenta: number;
  totalSkor: number;
  skorUser: number;
  skorTag: number;
  skorJenis: number;
  skorAdmin: number;
  skorSekolah: number;

  // approve/reject info
  approvedAt: string | null;
  approvedBy: string | null;
  approvedScope: DecisionScope | null;
  approvedScopeResolved?: DecisionScope | null;
  approvalNote: string | null;

  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectedScope: DecisionScope | null;
  rejectedScopeResolved?: DecisionScope | null;
  rejectionNote: string | null;

  detailTalenta: DetailTalentaSuperAdmin[];
}
