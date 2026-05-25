// ===================== STATUS TYPES =====================

// status DB / workflow (mengikuti Prisma TalentSubmissionStatus)
export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

// status khusus tampilan & filter Admin Talenta (turunan dari DB + adminScore)
export type ReviewStatus = "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED";

// mengikuti enum Prisma DecisionScope
export type DecisionScope = "SEKOLAH" | "TALENTA" | "SUPER_ADMIN";

export interface GTKProfile {
  nik: string;
  nama: string;
  sekolah: string;
  fotoUrl?: string | null;
}

/* ===================== INPUT (CREATE / EDIT) ===================== */
export interface TalentaDetailInput {
  namaKegiatan: string;
  penyelenggara: string;
  deskripsi?: string;
  jenis: string;
  bidang?: string;
  kategori?: string;
  subKategori?: string;
  tag: string[];
  userScore?: number;
  tanggalMulai?: string;
  durasiHari?: number;
  buktiUrl?: string;
  linkPendukung?: string;
}

export type TalentaDetailInputResolved = TalentaDetailInput;

/* ===================== STORED / VIEW ===================== */
export interface DetailTalenta {
  id: string;
  namaKegiatan: string;
  penyelenggara: string;
  deskripsi?: string;
  jenis: string;
  bidang: string;
  kategori: string;
  subKategori?: string;
  tag: string[];
  tagCount: number;
  tagScore: number;
  userScore?: number;
  jenisScore: number;
  adminScore: number;
  computedScore: number;
  tanggalMulai?: string;
  durasiHari?: number;
  buktiUrl?: string;
  linkPendukung?: string;
  keteranganPrestasi: string;
}

/* ===================== TALENTA (LIST ITEM) ===================== */
export interface Talenta {
  id: string;
  gtk: GTKProfile;

  /**
   * Status asli dari database (workflow).
   * Contoh: setelah admin sekolah approve, ini akan menjadi "APPROVED".
   */
  status: SubmissionStatus;

  /**
   * Status khusus UI Admin Talenta (turunan):
   * - PENDING  = status DB APPROVED tapi belum dinilai talenta (adminScore null)
   * - APPROVED = sudah dinilai talenta (adminScore not null)
   * - REJECTED = status DB REJECTED (bisa oleh sekolah/talenta/super admin)
   *
   * Optional untuk kompatibilitas sementara (jika ada endpoint lama yang belum mengirim field ini).
   */
  reviewStatus?: ReviewStatus;

  // ✅ agregat global per GTK (dalam scope field + filter yang sama)
  jumlahTalentaGtk?: number;

  // Skor breakdown untuk tabel sorting (akan Anda hide di UI, tapi biarkan dulu agar kompatibel)
  skorUser: number; // 20%
  skorTag: number; // 25%
  skorJenis: number; // 25%
  skorAdmin: number; // 30%
  totalSkor: number; // computedScore final

  // ==== decision meta ====
  approvedAt?: string | null;
  approvedBy?: string | null;
  approvedScope?: DecisionScope | null;
  approvalNote?: string | null;

  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectedScope?: DecisionScope | null;

  rejectedScopeResolved?: DecisionScope | null;
  rejectionNote?: string | null;

  detailTalenta: DetailTalenta[];

  // Opsional legacy
  skorSekolah?: number;
}

/* ===================== API Response types ===================== */
export interface ComputeScorePreview {
  tagScore: number;
  partialScore: number;
  finalScore: number | null;
}
