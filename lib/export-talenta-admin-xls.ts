import ExcelJS from "exceljs";

type Talenta = {
  jenisBidang: string;
  mapel?: string;
  activityName?: string;
  organizer?: string;
  categoryLabel?: string;
  subCategoryLabel?: string;
  tagsLabel?: string[];
  detail?: string;
  skor?: number;
};

type SubmissionRowForExport = {
  gtkName: string;
  mapel?: string;
  jenisBidang: string;
  keterangan: string;
  skor?: number;
  talentaCount: number; 
};

export async function exportTalentaAdminToXLS(
  data: SubmissionRowForExport[],
  schoolName: string,
  talentaName: string
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Potensi Diri");

  worksheet.columns = [
    { key: "no", width: 6 },
    { key: "nama", width: 22 },
    { key: "mapel", width: 18 },
    { key: "potensi", width: 28 },
    { key: "keterangan", width: 45 },
    { key: "jumlahTalenta", width: 14 },
    { key: "nilaiTalenta", width: 12 },
  ];

  const titleRow = worksheet.addRow(["DAFTAR POTENSI DIRI GTK"]);
  titleRow.font = { bold: true, size: 12 };
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.mergeCells("A1:G1");

  const subtitleRow = worksheet.addRow([schoolName]);
  subtitleRow.font = { bold: true, size: 10 };
  subtitleRow.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.mergeCells("A2:G2");

  worksheet.addRow([]);

  const talentaHeaderRow = worksheet.addRow([`Talenta : ${talentaName}`]);
  talentaHeaderRow.font = { bold: true, size: 10 };
  talentaHeaderRow.alignment = { horizontal: "left", vertical: "middle" };
  worksheet.mergeCells("A4:G4");

  worksheet.addRow([]);

  const headerRow = worksheet.addRow([
    "No",
    "Nama",
    "Mapel",
    "Potensi",
    "Keterangan",
    "Jml Talenta",
    "Nilai Talenta",
  ]);
  styleHeaderOnlyAtoG(worksheet, headerRow.number);

  // ==== SATU BARIS = SATU SUBMISSION ====
  data.forEach((rowData, index) => {
    const row = worksheet.addRow([
      index + 1,
      rowData.gtkName,
      rowData.mapel ?? "-",
      rowData.jenisBidang,
      rowData.keterangan,
      rowData.talentaCount ?? 1,
      rowData.skor ?? "-",
    ]);
    styleDataRowOnlyAtoG(worksheet, row.number);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Potensi-Diri-${talentaName.toLowerCase()}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetCellStyle(cell: ExcelJS.Cell) {
  cell.style = {};
}

function styleHeaderOnlyAtoG(ws: ExcelJS.Worksheet, rowNumber: number) {
  const row = ws.getRow(rowNumber);

  for (let col = 1; col <= 7; col++) {
    const cell = row.getCell(col);

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4CAF50" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };
  }

  for (let col = 8; col <= 40; col++) {
    resetCellStyle(row.getCell(col));
  }
}

function formatKeterangan(t: Talenta): string {
  const tags = t.tagsLabel?.length ? t.tagsLabel.join(", ") : null;
  const parts = [t.categoryLabel, t.subCategoryLabel, tags]
    .map((x) => (typeof x === "string" ? x.trim() : x))
    .filter(Boolean);
  return parts.length ? parts.join(" • ") : "-";
}

function styleDataRowOnlyAtoG(ws: ExcelJS.Worksheet, rowNumber: number) {
  const row = ws.getRow(rowNumber);

  for (let col = 1; col <= 7; col++) {
    const cell = row.getCell(col);

    resetCellStyle(cell);

    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };
  }

  row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  row.getCell(2).alignment = {
    horizontal: "left",
    vertical: "top",
    wrapText: true,
  };
  row.getCell(3).alignment = {
    horizontal: "left",
    vertical: "top",
    wrapText: true,
  };
  row.getCell(4).alignment = {
    horizontal: "left",
    vertical: "top",
    wrapText: true,
  };
  row.getCell(5).alignment = {
    horizontal: "left",
    vertical: "top",
    wrapText: true,
  };
  row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
  row.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
  row.height = 40;

  for (let col = 8; col <= 40; col++) {
    resetCellStyle(row.getCell(col));
  }
}
