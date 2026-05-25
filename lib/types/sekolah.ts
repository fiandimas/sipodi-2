// lib/types/sekolah.ts
export type JenjangSekolah = "SMA" | "SMK" | "MA" | "SLB";
export type StatusSekolah = "Negeri" | "Swasta";

export type Sekolah = {
  id: string;
  namaSekolah: string;
  npsn: string;
  jenjang: JenjangSekolah;
  status: StatusSekolah;
  kota: string;
  kepalaSekolah: string;
  jumlahSiswa: number;
  jumlahGtk: number;

  rate?: number;
};
