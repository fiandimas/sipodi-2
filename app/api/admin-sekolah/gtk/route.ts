// /api/admin-sekolah/gtk.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { Gender, GtkType, UserRole } from "@prisma/client";
import * as crypto from "crypto";  // Correct import for crypto

function normStr(x: unknown): string | undefined {
  if (typeof x !== "string") return undefined;
  const t = x.trim();
  return t ? t : undefined;
}

function notNull<T>(v: T | null | undefined): v is T {
  return v != null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_SEKOLAH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const q = normStr(searchParams.get("q"));
    const jenisParam = searchParams.get("jenis") || "all";
    const genderParam = searchParams.get("gender") || "all";

    const sort = (searchParams.get("sort") ?? "score") as "score" | "talenta" | "name";
    const dir = (searchParams.get("dir") ?? "desc") as "asc" | "desc";
    const orderDir = dir === "asc" ? 1 : -1;

    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(200, pageSize));

    // ============================
    // FILTER GTK
    // ============================
    const where: any = {
      schoolNpsn: session.schoolNpsn,
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { nik: { contains: q } },
      ];
    }

    if (jenisParam !== "all") {
      where.type = GtkType[jenisParam.toUpperCase() as keyof typeof GtkType];
    }

    if (genderParam !== "all") {
      where.gender = genderParam as Gender;
    }

    // =====================================
    // Ambil detail GTK langsung (1x query)
    // =====================================
    const allGtkDetail = await prisma.gtk.findMany({
      where,
      select: {
        nik: true,
        name: true,
        email: true,
        nuptk: true,
        nip: true,
        gender: true,
        birthDate: true,
        type: true,
        mapel: true,
        createdAt: true,            // <= penting untuk stabilitas urutan
        schoolNpsn: true,
        school: {
          select: {
            name: true,
            city: true,
            npsn: true,
            branchId: true,
          },
        },
      },
    });

    if (allGtkDetail.length === 0) {
      return NextResponse.json({
        data: [],
        page: safePage,
        pageSize: safePageSize,
        total: 0,
        totalPages: 1,
      });
    }

    const gtkNiks = allGtkDetail.map(g => g.nik);

    // ===================================
    // AGGREGATE TALENTA APPROVED
    // ===================================
    const talentaAgg = await prisma.talentSubmission.groupBy({
      by: ["gtkNik"],
      where: {
        gtkNik: { in: gtkNiks },
        status: "APPROVED",
      },
      _count: { _all: true },
    });

    const scoreAgg = await prisma.talentSubmission.groupBy({
      by: ["gtkNik"],
      where: {
        gtkNik: { in: gtkNiks },
        status: "APPROVED",
        computedScore: { not: null },
      },
      _sum: { computedScore: true },
    });

    const talentaMap = new Map(talentaAgg.map(x => [x.gtkNik, x._count._all]));
    const scoreMap = new Map(scoreAgg.map(x => [x.gtkNik, x._sum.computedScore ?? 0]));

    // Merge data
    const merged = allGtkDetail.map(g => ({
      ...g,
      talentaCount: talentaMap.get(g.nik) ?? 0,
      totalSkorDinilai: scoreMap.get(g.nik) ?? 0,
    }));

    // ===================
    // SORTING — STABIL
    // ===================
    merged.sort((a, b) => {
      if (sort === "score") {
        const diff = a.totalSkorDinilai - b.totalSkorDinilai;
        if (diff !== 0) return orderDir === 1 ? diff : -diff;
      }

      if (sort === "talenta") {
        const diff = a.talentaCount - b.talentaCount;
        if (diff !== 0) return orderDir === 1 ? diff : -diff;
      }

      if (sort === "name") {
        const diff = a.name.localeCompare(b.name, "id-ID");
        if (diff !== 0) return orderDir === 1 ? diff : -diff;
      }

      // fallback stabil (createdAt ASC)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    // ===================
    // PAGINATION
    // ===================
    const total = merged.length;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));

    const paginated = merged.slice(
      (safePage - 1) * safePageSize,
      safePage * safePageSize
    );

    return NextResponse.json({
      data: paginated,
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages,
    });
  } catch (err) {
    console.error("GET /api/admin-sekolah/gtk ERROR:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_SEKOLAH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Body tidak valid (bukan JSON)." },
        { status: 400 }
      );
    }

    const {
      nik,
      name,
      email,
      nuptk,
      nip,
      gender,
      birthDate,
      type,
      mapel
    } = body;

    const nikTrim = normStr(nik);
    const nameTrim = normStr(name);

    // sekolah berasal dari session
    const schoolNpsnTrim = normStr(session.schoolNpsn);

    if (!nikTrim || !nameTrim || !schoolNpsnTrim) {
      return NextResponse.json(
        { error: "Field nik, name, dan schoolNpsn wajib diisi." },
        { status: 400 }
      );
    }

    // cek sekolah exist (walau admin sekolah pasti valid)
    const school = await prisma.school.findUnique({
      where: { npsn: schoolNpsnTrim },
      select: { npsn: true }
    });

    if (!school) {
      return NextResponse.json(
        { error: "Sekolah tidak ditemukan." },
        { status: 400 }
      );
    }

    // cek apakah nik sudah jadi GTK lain
    const existingGtk = await prisma.gtk.findUnique({
      where: { nik: nikTrim },
      select: { nik: true }
    });

    if (existingGtk) {
      return NextResponse.json(
        { error: "NIK ini sudah digunakan oleh GTK lain." },
        { status: 400 }
      );
    }

    // buat GTK tanpa create user
    const gtk = await prisma.gtk.create({
      data: {
        nik: nikTrim,
        name: nameTrim,
        email: normStr(email) ?? null,
        nuptk: normStr(nuptk) ?? null,
        nip: normStr(nip) ?? null,
        gender: gender ?? null,
        birthDate: birthDate ? new Date(birthDate) : null,
        type: type ?? null,
        mapel: normStr(mapel) ?? null,
        schoolNpsn: schoolNpsnTrim
      },
      select: {
        nik: true,
        name: true,
        email: true,
        nuptk: true,
        nip: true,
        gender: true,
        birthDate: true,
        type: true,
        mapel: true,
        schoolNpsn: true
      }
    });

    return NextResponse.json(
      { data: gtk },
      { status: 201 }
    );

  } catch (err) {
    console.error("POST /api/admin-sekolah/gtk error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
