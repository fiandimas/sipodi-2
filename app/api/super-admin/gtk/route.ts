import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { Gender, GtkType, PasswordAlgo, UserRole } from "@prisma/client";
import { DecisionScope, TalentSubmissionStatus } from "@prisma/client";
import crypto from "crypto";

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
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const q = normStr(searchParams.get("q"));
    const schoolNpsn = normStr(searchParams.get("schoolNpsn"));
    const branchId = normStr(searchParams.get("branchId"));

    const jenisParam = searchParams.get("jenis") || "all";
    const genderParam = searchParams.get("gender") || "all";

    const sort = (searchParams.get("sort") ?? "score") as "score" | "talenta" | "name";
    const dir = (searchParams.get("dir") ?? "desc") as "asc" | "desc";
    const orderDir = dir === "asc" ? "asc" : "desc";

    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 && pageSize <= 200 ? pageSize : 20;

    const where: any = {};

    if (schoolNpsn) {
      where.schoolNpsn = schoolNpsn;
    } else if (branchId) {
      where.school = { branchId };
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { nik: { contains: q } },
      ];
    }

    if (jenisParam !== "all") {
      let enumValue: GtkType | null = null;

      if (jenisParam === "Guru") enumValue = GtkType.GURU;
      if (jenisParam === "Tendik") enumValue = GtkType.TENDIK;
      if (jenisParam === "Kepala Sekolah") enumValue = GtkType.KEPALA_SEKOLAH;
      if (jenisParam === "Kepala Seksi") enumValue = GtkType.KEPALA_SEKSI;
      if (jenisParam === "Kepala Cabang Dinas") enumValue = GtkType.KEPALA_CABANG_DINAS;

      if (!enumValue) {
        return NextResponse.json(
          {
            error:
              "Invalid jenis. Gunakan salah satu: all | Guru | Tendik | Kepala Sekolah | Kepala Seksi | Kepala Cabang Dinas",
          },
          { status: 400 }
        );
      }

      where.type = enumValue;
    }

    if (genderParam !== "all") {
      if (genderParam === "L" || genderParam === "P") {
        where.gender = genderParam as Gender;
      } else {
        return NextResponse.json({ error: "Invalid gender. Gunakan: all | L | P" }, { status: 400 });
      }
    }

    const allGtkNiks = await prisma.gtk.findMany({
      where,
      select: { nik: true, name: true },
    });

    const total = allGtkNiks.length;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));

    if (total === 0) {
      return NextResponse.json({
        data: [],
        page: safePage,
        pageSize: safePageSize,
        total: 0,
        totalPages: 1,
      });
    }

    const gtkNiks = allGtkNiks.map((g) => g.nik);

    // HITUNG JUMLAH TALENTA APPROVED TANPA FILTER SCOPE
    const verifiedAgg = await prisma.talentSubmission.groupBy({
      by: ["gtkNik"],
      where: {
        gtkNik: { in: gtkNiks },
        status: TalentSubmissionStatus.APPROVED,
      },
      _count: { _all: true },
    });

    // HITUNG TOTAL SKOR SEMUA SUBMISSION APPROVED YANG PUNYA SKOR
    const scoredAgg = await prisma.talentSubmission.groupBy({
      by: ["gtkNik"],
      where: {
        gtkNik: { in: gtkNiks },
        status: TalentSubmissionStatus.APPROVED,
        computedScore: { not: null },
      },
      _sum: { computedScore: true },
    });

    const verifiedCountMap = new Map(verifiedAgg.map((c) => [c.gtkNik, c._count._all]));
    const scoreSumMap = new Map(scoredAgg.map((c) => [c.gtkNik, c._sum.computedScore ?? 0]));

    const sortedGtkNiks = [...gtkNiks].sort((a, b) => {
      if (sort === "talenta") {
        const av = verifiedCountMap.get(a) ?? 0;
        const bv = verifiedCountMap.get(b) ?? 0;
        const diff = bv - av;
        if (diff !== 0) return orderDir === "desc" ? diff : -diff;
      } else if (sort === "name") {
        const nameMap = new Map(allGtkNiks.map((g) => [g.nik, g.name ?? ""]));
        const an = (nameMap.get(a) ?? "").toLowerCase();
        const bn = (nameMap.get(b) ?? "").toLowerCase();
        const cmp = an.localeCompare(bn, "id-ID");
        if (cmp !== 0) return orderDir === "desc" ? -cmp : cmp;
      } else {
        const av = scoreSumMap.get(a) ?? 0;
        const bv = scoreSumMap.get(b) ?? 0;
        const diff = bv - av;
        if (diff !== 0) return orderDir === "desc" ? diff : -diff;
      }

      const nameMap = new Map(allGtkNiks.map((g) => [g.nik, g.name ?? ""]));
      const an = (nameMap.get(a) ?? "").toLowerCase();
      const bn = (nameMap.get(b) ?? "").toLowerCase();
      const cmpName = an.localeCompare(bn, "id-ID");
      if (cmpName !== 0) return cmpName;

      return a.localeCompare(b, "id-ID");
    });

    const start = (safePage - 1) * safePageSize;
    const pageGtkNiks = sortedGtkNiks.slice(start, start + safePageSize);

    const gtks = await prisma.gtk.findMany({
      where: { nik: { in: pageGtkNiks } },
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
        schoolNpsn: true,
        school: {
          select: {
            name: true,
            npsn: true,
            city: true,
            branchId: true,
          },
        },
      },
    });

    const gtkMap = new Map(gtks.map((g) => [g.nik, g]));
    const orderedGtks = pageGtkNiks.map((nik) => gtkMap.get(nik)).filter(notNull);

    const data = orderedGtks.map((g) => ({
      ...g,
      talentaCount: verifiedCountMap.get(g.nik) ?? 0,
      totalSkorDinilai: scoreSumMap.get(g.nik) ?? 0,
    }));

    return NextResponse.json({
      data,
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages,
    });
  } catch (e) {
    console.error("GET /api/super-admin/gtk error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
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
      mapel,
      schoolNpsn,
    } = body as {
      nik?: string;
      name?: string;
      email?: string;
      nuptk?: string;
      nip?: string;
      gender?: Gender | null;
      birthDate?: string | null;
      type?: GtkType | null;
      mapel?: string | null;
      schoolNpsn?: string;
    };

    const nikTrim = normStr(nik);
    const nameTrim = normStr(name);
    const schoolNpsnTrim = normStr(schoolNpsn);

    if (!nikTrim || !nameTrim || !schoolNpsnTrim) {
      return NextResponse.json(
        { error: "Field nik, name, dan schoolNpsn wajib diisi." },
        { status: 400 }
      );
    }

    const school = await prisma.school.findUnique({
      where: { npsn: schoolNpsnTrim },
      select: { npsn: true, branchId: true },
    });

    if (!school) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 400 });
    }

    // username tetap pakai nama
    const baseUsername = nameTrim;

    // cek username unique
    const existingUserWithSameUsername = await prisma.user.findUnique({
      where: { username: baseUsername },
      select: { id: true },
    });
    if (existingUserWithSameUsername) {
      return NextResponse.json(
        { error: "Username sudah dipakai user lain. Silakan ubah nama GTK." },
        { status: 400 }
      );
    }

    // ✅ cek nik sudah dipakai user lain atau belum (lebih jelas daripada menunggu P2002)
    const existingUserWithSameGtk = await prisma.user.findFirst({
      where: { gtkNik: nikTrim },
      select: { id: true },
    });
    if (existingUserWithSameGtk) {
      return NextResponse.json(
        { error: "GTK (NIK) ini sudah terhubung dengan user lain." },
        { status: 400 }
      );
    }

    const rawPassword = nikTrim;
    const hashedPassword = crypto.createHash("sha256").update(rawPassword).digest("hex");

    const result = await prisma.$transaction(async (tx) => {
      const gtk = await tx.gtk.create({
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
          schoolNpsn: schoolNpsnTrim,
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
          schoolNpsn: true,
        },
      });

      const user = await tx.user.create({
        data: {
          username: baseUsername,
          password: hashedPassword,
          name: gtk.name,
          role: UserRole.USER_GTK,
          isActive: true,
          branchId: school.branchId,
          schoolNpsn: school.npsn,
          gtkNik: gtk.nik,
          passwordAlgo: PasswordAlgo.SHA256,
        },
        select: { id: true, role: true },
      });

      // ✅ ini yang kamu butuhkan untuk export berbasis access
      await tx.userAccess.create({
        data: {
          userId: user.id,
          role: user.role,          // USER_GTK
          schoolNpsn: school.npsn,  // scope sekolah untuk GTK
          branchId: school.branchId // opsional tapi berguna kalau export butuh cabang
        },
      });

      return gtk;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/super-admin/gtk error:", e);

    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Data duplikat: NIK / email / username / GTK sudah terhubung." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
