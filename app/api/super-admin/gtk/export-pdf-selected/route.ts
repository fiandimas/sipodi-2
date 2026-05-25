import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import jsPDF from "jspdf";
import type { Gtk, School } from "@prisma/client";

type GtkWithRelations = Gtk & {
  school: Pick<School, "npsn" | "name" | "city">;
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      niks?: string[];
    } | null;

    const niks = body?.niks ?? [];
    if (!Array.isArray(niks) || niks.length === 0) {
      return NextResponse.json(
        { error: "niks array is required" },
        { status: 400 }
      );
    }

    const branchId = (session as any).branchId as string | null;

    const gtkData: GtkWithRelations[] = await prisma.gtk.findMany({
      where: {
        nik: { in: niks },
        ...(branchId ? { school: { branchId } } : {}),
      },
      include: {
        school: {
          select: { npsn: true, name: true, city: true, branchId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (gtkData.length === 0) {
      return NextResponse.json(
        { error: "No GTK found for given NIKs" },
        { status: 404 }
      );
    }

    // ===== CREATE PDF =====
    const doc = new jsPDF(); // A4 portrait
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ===== HEADER =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Data GTK Terpilih", pageWidth / 2, 15, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `Laporan dibuat: ${new Date().toLocaleDateString("id-ID")}`,
      pageWidth / 2,
      22,
      { align: "center" }
    );

    // ===== TABLE SETUP =====
    const startY = 30;
    let y = startY;
    const rowHeight = 7;

    // posisi kolom
    const colNo = 10;
    const colNik = 22;
    const colNama = 55;
    const colGender = 110;
    const colJenis = 120;
    const colSekolah = 145;
    const colKota = 180;

    // header tabel
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("No", colNo, y);
    doc.text("NIK", colNik, y);
    doc.text("Nama", colNama, y);
    doc.text("L/P", colGender, y);
    doc.text("Jenis", colJenis, y);
    doc.text("Sekolah", colSekolah, y);
    doc.text("Kota", colKota, y);

    y += rowHeight;
    doc.setLineWidth(0.2);
    doc.line(8, y - 4, pageWidth - 8, y - 4);

    // ===== DATA ROWS =====
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    gtkData.forEach((gtk: GtkWithRelations, index: number) => {
      // page break
      if (y > pageHeight - 15) {
        addFooter(doc);
        doc.addPage();
        y = startY;

        // redraw header on new page
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("No", colNo, y);
        doc.text("NIK", colNik, y);
        doc.text("Nama", colNama, y);
        doc.text("L/P", colGender, y);
        doc.text("Jenis", colJenis, y);
        doc.text("Sekolah", colSekolah, y);
        doc.text("Kota", colKota, y);

        y += rowHeight;
        doc.setLineWidth(0.2);
        doc.line(8, y - 4, pageWidth - 8, y - 4);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }

      const no = (index + 1).toString();
      const nik = gtk.nik;
      const nama = gtk.name;
      const gender = gtk.gender ?? "-";
      const jenis = gtk.type ?? "-";
      const sekolah = gtk.school?.name ?? "-";
      const kota = gtk.school?.city ?? "-";

      doc.text(no, colNo, y);
      doc.text(nik, colNik, y);
      doc.text(truncate(doc, nama, 50), colNama, y);
      doc.text(gender, colGender, y);
      doc.text(truncate(doc, jenis, 20), colJenis, y);
      doc.text(truncate(doc, sekolah, 30), colSekolah, y);
      doc.text(truncate(doc, kota, 20), colKota, y);

      y += rowHeight;
    });

    // footer untuk semua halaman
    addFooter(doc);

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const filename = `GTK_TERPILIH_${new Date()
      .toISOString()
      .split("T")[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF export selected error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

// helper: truncate supaya teks tidak melebar keluar kolom
function truncate(doc: jsPDF, text: string, maxWidth: number): string {
  const w = doc.getTextWidth(text);
  if (w <= maxWidth) return text;
  let truncated = text;
  while (doc.getTextWidth(truncated + "...") > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
}

// helper: footer nomor halaman
function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    const text = `Halaman ${i} dari ${pageCount}`;
    doc.text(text, pageWidth / 2, pageHeight - 8, { align: "center" });
  }
}
