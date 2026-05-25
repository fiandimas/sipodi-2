import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { GTK } from "@/lib/types/gtk";

export function exportGTKtoPDF(data: GTK[]) {
  const doc = new jsPDF();

  doc.text("Data GTK", 14, 15);

  autoTable(doc, {
    startY: 20,
    head: [["Nama", "NUPTK", "NIP", "Jenis", "Sekolah", "Talenta"]],
    body: data.map((item) => [
      item.namaLengkap,
      item.nuptk,
      item.nip ?? "-",
      item.jenis,
      item.sekolah,
      item.talenta.toString(),
    ]),
  });

  doc.save("data-gtk.pdf");
}
