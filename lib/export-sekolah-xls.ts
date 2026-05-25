import * as XLSX from "xlsx";
import type { Sekolah } from "@/lib/types/sekolah";

export function exportSekolahToXLS(data: Sekolah[]) {
  const worksheet = XLSX.utils.json_to_sheet(
    data.map((item) => ({
      "Nama Sekolah": item.namaSekolah,
      NPSN: item.npsn,
      Jenjang: item.jenjang,
      Status: item.status,
      Kota: item.kota,
      "Kepala Sekolah": item.kepalaSekolah,
      "Jumlah Siswa": item.jumlahSiswa,
      "Jumlah GTK": item.jumlahGtk,
      Rate: item.rate ?? 0,
    }))
  );

  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    // kolom Rate adalah kolom terakhir (sesuaikan kalau urutan kolom berubah)
    const rateCol = range.e.c; 
    const addr = XLSX.utils.encode_cell({ r: R, c: rateCol });
    const cell = worksheet[addr];
    if (cell && typeof cell.v === "number") cell.z = "0.00";
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data Sekolah");
  XLSX.writeFile(workbook, "data-sekolah.xlsx");
}
