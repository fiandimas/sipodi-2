export type GTK = {
  nik: string;
  name: string;
  email: string | null;
  nuptk: string | null;
  nip: string | null;
  gender: "L" | "P" | null;
  type: "GURU" | "TENDIK" | "KEPALA_SEKOLAH" | "KEPALA_SEKSI" | "KEPALA_CABANG_DINAS" | null;
  mapel: string | null;

  birthDate: string | null; // yyyy-mm-dd atau null

  schoolNpsn: string;
  school: {
    npsn: string;
    name: string;
    city: string;
  } | null;
};
