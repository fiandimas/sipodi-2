import * as XLSX from "xlsx";
import { GTK } from "@/lib/types/gtk";

export function exportGTKtoXLS(data: GTK[]) {
  const worksheet = XLSX.utils.json_to_sheet(
    data.map((item) => ({
      Nama: item.namaLengkap,
      NUPTK: item.nuptk,
      NIP: item.nip ?? "-",
      Jenis: item.jenis,
      Sekolah: item.sekolah,
      Talenta: item.talenta,
    }))
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data GTK");

  XLSX.writeFile(workbook, "data-gtk.xlsx");
}
