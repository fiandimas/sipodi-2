// app/api/super-admin/gtk/export-xls/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import ExcelJS from "exceljs";
import type { Gtk, School, Gender, GtkType } from "@prisma/client";
import { UserRole } from "@prisma/client";

type GtkWithRelations = Gtk & {
  school: Pick<School, "npsn" | "name" | "city" | "branchId"> | null;
};

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ambil branchId dari UserAccess
    const userId = session.sub;
    const superAccess = await prisma.userAccess.findFirst({
      where: { userId, role: UserRole.SUPER_ADMIN },
      orderBy: { createdAt: "desc" },
      select: { branchId: true },
    });

    const branchId = superAccess?.branchId ?? null;
    if (!branchId) {
      return NextResponse.json(
        { error: "SUPER_ADMIN belum terikat ke cabang (branchId null di UserAccess)." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const schoolNpsn = searchParams.get("schoolNpsn") || undefined;
    const jenisParam = searchParams.get("jenis") || "all";
    const genderParam = searchParams.get("gender") || "all";

    const where: any = { school: { branchId }, ...(schoolNpsn ? { schoolNpsn } : {}) };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { nik: { contains: q } },
      ];
    }

    // Mapping UI "jenis" ke enum GtkType
    if (jenisParam !== "all") {
      let enumValue: GtkType | null = null;
      switch (jenisParam) {
        case "Guru":
          enumValue = "GURU";
          break;
        case "Tendik":
          enumValue = "TENDIK";
          break;
        case "Kepala Sekolah":
          enumValue = "KEPALA_SEKOLAH";
          break;
        case "Kepala Seksi":
          enumValue = "KEPALA_SEKSI";
          break;
        case "Kepala Cabang Dinas":
          enumValue = "KEPALA_CABANG_DINAS";
          break;
      }
      if (!enumValue) {
        return NextResponse.json(
          {
            error:
              "Invalid jenis. Gunakan: all | Guru | Tendik | Kepala Sekolah | Kepala Seksi | Kepala Cabang Dinas",
          },
          { status: 400 }
        );
      }
      where.type = enumValue;
    }

    // Filter gender
    if (genderParam !== "all") {
      if (genderParam === "L" || genderParam === "P") {
        where.gender = genderParam as Gender;
      } else {
        return NextResponse.json({ error: "Invalid gender. Gunakan: all | L | P" }, { status: 400 });
      }
    }

    // Ambil data GTK
    const gtkData: GtkWithRelations[] = await prisma.gtk.findMany({
      where,
      include: { school: { select: { npsn: true, name: true, city: true, branchId: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Generate Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data GTK");

    worksheet.columns = [
      { header: "No", key: "no", width: 5 },
      { header: "NIK", key: "nik", width: 18 },
      { header: "Nama", key: "name", width: 25 },
      { header: "Email", key: "email", width: 25 },
      { header: "L/P", key: "gender", width: 8 },
      { header: "Jenis", key: "type", width: 15 },
      { header: "Mapel", key: "mapel", width: 18 },
      { header: "Sekolah", key: "schoolName", width: 25 },
      { header: "NPSN", key: "schoolNpsn", width: 15 },
      { header: "Kota", key: "schoolCity", width: 15 },
      { header: "Tanggal Lahir", key: "birthDate", width: 18 },
      { header: "Tgl Dibuat", key: "createdAt", width: 18 },
      { header: "Tgl Diupdate", key: "updatedAt", width: 18 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    gtkData.forEach((gtk, index) => {
      worksheet.addRow({
        no: index + 1,
        nik: gtk.nik,
        name: gtk.name,
        email: gtk.email ?? "-",
        gender: gtk.gender ?? "-",
        type: gtk.type ?? "-",
        mapel: gtk.mapel ?? "-",
        schoolName: gtk.school?.name ?? "-",
        schoolNpsn: gtk.school?.npsn ?? "-",
        schoolCity: gtk.school?.city ?? "-",
        birthDate: gtk.birthDate ? new Date(gtk.birthDate).toLocaleDateString("id-ID") : "-",
        createdAt: gtk.createdAt ? new Date(gtk.createdAt).toLocaleDateString("id-ID") : "-",
        updatedAt: gtk.updatedAt ? new Date(gtk.updatedAt).toLocaleDateString("id-ID") : "-",
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="GTK_${
          new Date().toISOString().split("T")[0]
        }.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export GTK error:", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
