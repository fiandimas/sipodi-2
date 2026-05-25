import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Sekolah = {
  namaSekolah: string;
  npsn: string;
  jenjang: string;
  status: string;
  kota: string;
  kepalaSekolah: string;
  jumlahSiswa: number;
  jumlahGtk: number;
};

export function exportSekolahToPDF(data: Sekolah[]) {
  const doc = new jsPDF("landscape");

  doc.setFontSize(14);
  doc.text("Data Sekolah", 14, 15);

  autoTable(doc, {
    startY: 22,
    head: [[
      "Nama Sekolah",
      "NPSN",
      "Jenjang",
      "Status",
      "Kota",
      "Kepala Sekolah",
      "Jumlah Siswa",
      "Jumlah GTK",
    ]],
    body: data.map((item) => [
      item.namaSekolah,
      item.npsn,
      item.jenjang,
      item.status,
      item.kota,
      item.kepalaSekolah,
      item.jumlahSiswa.toString(),
      item.jumlahGtk.toString(),
    ]),
    styles: {
      fontSize: 9,
    },
    headStyles: {
      fillColor: [41, 128, 185],
    },
  });

  doc.save("data-sekolah.pdf");
}
