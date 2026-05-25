import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SubmissionRow } from "@/lib/types/talent-submission-admin";

type KepalaSekolah = {
  name?: string | null;
  rank?: string | null;
  nip?: string | null;
};

export function exportTalentaAdminToPDF(
  data: SubmissionRow[],
  schoolName: string,
  talentaName: string,
  kopSekolah?: {
    alamat?: string;
    telepon?: string;
    website?: string;
  },
  kepalaSekolah?: KepalaSekolah
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 15;
  const right = pageWidth - 15;
  const tableWidth = right - left;

  let y = 10;

  // ===== KOP SEKOLAH =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`KOP ${schoolName}`, pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (kopSekolah?.alamat) {
    doc.text(kopSekolah.alamat, pageWidth / 2, y, { align: "center" });
    y += 5;
  }
  if (kopSekolah?.telepon) {
    doc.text(`Telepon: ${kopSekolah.telepon}`, pageWidth / 2, y, {
      align: "center",
    });
    y += 5;
  }
  if (kopSekolah?.website) {
    doc.text(kopSekolah.website, pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  y += 6;

  // ===== GARIS DOUBLE RAPAT (atas) =====
  drawDoubleLine(doc, left, right, y);
  y += 6;

  // ===== JUDUL =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Potensi Diri Guru dan Tenaga Kependidikan", pageWidth / 2, y, {
    align: "center",
  });
  y += 6;

  // ===== SUBTITLE =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    "Cabang Dinas Pendidikan Wilayah Malang (Kota Malang – Kota Batu)",
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 5;

  // ===== GARIS DOUBLE RAPAT (bawah) =====
  drawDoubleLine(doc, left, right, y);
  y += 10;

  // ===== TALENTA : [NAMA TALENTA] =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Talenta : ${talentaName}`, left, y);
  y += 8;

  // ===== TABLE =====
  const body = data.map((t, i) => [
    String(i + 1), // No
    t.gtk?.name ?? "-", // Nama
    t.gtk?.mapel ?? "-", // Mapel
    t.fieldLabel ?? "-", // Potensi
    formatKeterangan(t), // Keterangan
  ]);

  const wNo = 14;
  const wNama = 32;
  const wMapel = 28;
  const wPotensi = 32;
  const wKeterangan = tableWidth - (wNo + wNama + wMapel + wPotensi);

  autoTable(doc, {
    startY: y,
    tableWidth,
    margin: { left, right },
    head: [["No", "Nama", "Mapel", "Potensi", "Keterangan"]],
    body,
    theme: "grid",

    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 4,
      overflow: "linebreak",
      valign: "top",
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.6,
    },

    headStyles: {
      fillColor: [76, 175, 80],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.8,
    },

    bodyStyles: {
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.6,
    },

    columnStyles: {
      0: { cellWidth: wNo, halign: "center" },
      1: { cellWidth: wNama },
      2: { cellWidth: wMapel },
      3: { cellWidth: wPotensi },
      4: { cellWidth: wKeterangan },
    },

    didParseCell: (hook) => {
      const { cell, row, column, section } = hook;
      const table = hook.table;
      const lastRowIndex = table.body.length - 1;
      const lastColIndex = table.columns.length - 1;

      const isFirstRow = section === "head" ? row.index === 0 : row.index === 0;
      const isLastBodyRow = section === "body" && row.index === lastRowIndex;
      const isFirstCol = column.index === 0;
      const isLastCol = column.index === lastColIndex;

      cell.styles.lineWidth = 0.6;

      if (section === "head") {
        cell.styles.lineWidth = 0.9;
      }

      if (isFirstCol || isLastCol || isFirstRow || isLastBodyRow) {
        cell.styles.lineWidth = Math.max(cell.styles.lineWidth as number, 1.1);
      }
    },
  });

  // ===== SIGNATURE =====
  let finalY = (doc as any).lastAutoTable?.finalY ?? y + 40;
  finalY += 22;

  const rightX = pageWidth - 70;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text("Malang, .......................... 2025", rightX, finalY);
  finalY += 10;

  doc.text("Mengetahui,", rightX, finalY);
  finalY += 8;

  doc.text("Kepala Sekolah,", rightX, finalY);
  finalY += 18;

  // ==== DATA KEPALA SEKOLAH OTOMATIS ====
  const ks = kepalaSekolah ?? {};

  const namaKepsek =
    ks.name && ks.name.trim().length > 0
      ? ks.name
      : "................................";
  const pangkatGol =
    ks.rank && ks.rank.trim().length > 0 ? ks.rank : "Pangkat/Gol";
  const nipText =
    ks.nip && ks.nip.trim().length > 0
      ? `NIP ${ks.nip}`
      : "NIP ................................";

  doc.setFont("helvetica", "bold");
  doc.text(namaKepsek, rightX, finalY);
  doc.setLineWidth(0.4);
  doc.line(rightX, finalY + 2, rightX + 45, finalY + 2);
  finalY += 8;

  doc.setFont("helvetica", "normal");
  doc.text(pangkatGol, rightX, finalY);
  finalY += 7;

  doc.text(nipText, rightX, finalY);

  doc.save(`potensi-diri-${talentaName.toLowerCase()}.pdf`);
}

// Helper: garis double rapat
function drawDoubleLine(doc: jsPDF, x1: number, x2: number, y: number) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(x1, y, x2, y);
  doc.line(x1, y + 0.9, x2, y + 0.9);
}

// Helper: format keterangan
function formatKeterangan(t: SubmissionRow): string {
  const tags = t.tagsLabel?.length ? t.tagsLabel.join(", ") : null;
  const parts = [t.categoryLabel, t.subCategoryLabel, tags]
    .map((x) => x?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" • ") : "-";
}
