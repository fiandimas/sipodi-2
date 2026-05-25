// app/api/super-admin/gtk/print/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import type { Gender, GtkType } from "@prisma/client";
import { UserRole } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    // 1) Auth pakai enum UserRole
    if (!session || session.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Ambil branchId dari UserAccess (source of truth)
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

    // 3) Ambil filter dari query params
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const schoolNpsn = searchParams.get("schoolNpsn") || undefined;
    const jenisParam = searchParams.get("jenis") || "all"; // Guru | Tendik | Kepala Sekolah | ...
    const genderParam = searchParams.get("jk") || "all"; // L | P | all

    const where: any = { school: { branchId }, ...(schoolNpsn ? { schoolNpsn } : {}) };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { nik: { contains: q } },
      ];
    }

    // 4) Mapping UI "jenis" ke enum GtkType
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

    // 5) Filter gender
    if (genderParam !== "all") {
      if (genderParam === "L" || genderParam === "P") {
        where.gender = genderParam as Gender;
      } else {
        return NextResponse.json({ error: "Invalid jk. Gunakan: all | L | P" }, { status: 400 });
      }
    }

    // 6) Query GTK
    const gtks = await prisma.gtk.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        nik: true,
        name: true,
        email: true,
        gender: true,
        type: true,
        mapel: true,
        birthDate: true,
        schoolNpsn: true,
        school: {
          select: {
            name: true,
            npsn: true,
            city: true,
          },
        },
      },
    });

    // 7) Format data
    const data = gtks.map((g) => ({
      nik: g.nik,
      name: g.name,
      email: g.email,
      gender: g.gender,
      type: g.type,
      mapel: g.mapel,
      schoolName: g.school?.name ?? null,
      schoolNpsn: g.school?.npsn ?? g.schoolNpsn ?? null,
      city: g.school?.city ?? null,
      birthDate: g.birthDate ? g.birthDate.toISOString().slice(0, 10) : null,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    console.error("GET /api/super-admin/gtk/print error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
