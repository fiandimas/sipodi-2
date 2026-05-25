import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { Prisma, TalentSubmissionStatus } from "@prisma/client";

const PAGE_SIZE_DEFAULT = 20;

type StatusParam = "all" | "PENDING" | "APPROVED" | "REJECTED";
type SortKey = "name" | "school" | "count" | "score";
type SortDir = "asc" | "desc";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN_TALENTA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const fieldId = (searchParams.get("fieldId") ?? "").trim();
  if (!fieldId) return NextResponse.json({ error: "fieldId wajib diisi" }, { status: 400 });

  const allowed = session.talentFields?.some((f) => f.id === fieldId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const page = Math.max(Number(searchParams.get("page") || "1"), 1);
  const pageSize = Math.max(Number(searchParams.get("pageSize") || String(PAGE_SIZE_DEFAULT)), 1);

  const rawStatusParam = (searchParams.get("status") ?? "all") as StatusParam;
  const statusParam: StatusParam =
    rawStatusParam === "PENDING" || rawStatusParam === "APPROVED" || rawStatusParam === "REJECTED"
      ? rawStatusParam
      : "all";

  const kategoriParam = searchParams.get("kategori") ?? "all";
  const jenisParam = (searchParams.get("jenis") ?? "all").trim();
  const search = (searchParams.get("q") ?? "").trim();

  const sort = (searchParams.get("sort") ?? "name") as SortKey;
  const dir = (searchParams.get("dir") ?? "asc") as SortDir;

  const sortKey: SortKey = ["name", "school", "count", "score"].includes(sort) ? sort : "name";
  const sortDir: SortDir = dir === "desc" ? "desc" : "asc";

  // ==== Filter dasar (harus sesuai aturan admin talenta) ====
  // catatan: PENDING/APPROVED di UI admin talenta Anda adalah turunan dari status DB APPROVED
  // - PENDING  => status DB APPROVED + adminScore null
  // - APPROVED => status DB APPROVED + adminScore not null
  // - REJECTED => status DB REJECTED
  const whereBase: Prisma.TalentSubmissionWhereInput = {
    fieldId,
    status: { in: [TalentSubmissionStatus.APPROVED, TalentSubmissionStatus.REJECTED] },
  };

  let statusFilter: Prisma.TalentSubmissionWhereInput = {};
  if (statusParam === "PENDING") {
    statusFilter = { status: TalentSubmissionStatus.APPROVED, adminScore: null };
  } else if (statusParam === "APPROVED") {
    statusFilter = { status: TalentSubmissionStatus.APPROVED, adminScore: { not: null } };
  } else if (statusParam === "REJECTED") {
    statusFilter = { status: TalentSubmissionStatus.REJECTED };
  }

  const where: Prisma.TalentSubmissionWhereInput = {
    ...whereBase,
    ...(statusParam !== "all" ? statusFilter : {}),
    ...(kategoriParam !== "all" ? { category: { name: kategoriParam } } : {}),
    ...(jenisParam !== "all" ? { type: { name: jenisParam } } : {}),
    ...(search
      ? {
          OR: [
            { gtk: { name: { contains: search, mode: "insensitive" } } },
            { gtk: { school: { name: { contains: search, mode: "insensitive" } } } },
            { activityName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // ==== Query 1: daftar gtkNik hasil groupBy + agregat ====
  // Prisma groupBy mendukung _count/_avg dan bisa skip/take untuk pagination. [web:737]
  const grouped = await prisma.talentSubmission.groupBy({
    by: ["gtkNik"],
    where,
    _count: { _all: true },
    _avg: { computedScore: true },

    // orderBy agregat didukung untuk _count; untuk _avg kadang versi tertentu terbatas,
    // jadi kita buat sort stabil: name/school via query kedua (detail gtk) + sort in-memory setelah merge.
    // Namun untuk "akurat global" + sorting benar, implement paling aman: 2 tahap:
    // - ambil semua gtkNik yang match (tanpa pagination) lalu sort & paginate di server memory.
    // Untuk performa awal (data tidak terlalu besar), ini cukup.
  });

  // ==== total group (jumlah GTK) ====
  const totalGroups = grouped.length;

  // ==== Query 2: ambil detail GTK + sekolah untuk semua gtkNik yang match ====
  const gtkNiks = grouped.map((g) => g.gtkNik);

  const gtks = await prisma.gtk.findMany({
    where: { nik: { in: gtkNiks } },
    select: {
      nik: true,
      name: true,
      photoUrl: true,
      school: { select: { name: true } },
    },
  });

  const gtkMap = new Map(gtks.map((g) => [g.nik, g]));

  const rows = grouped.map((g) => {
    const gtk = gtkMap.get(g.gtkNik);
    return {
      gtk: {
        nik: g.gtkNik,
        nama: gtk?.name ?? "-",
        sekolah: gtk?.school?.name ?? "-",
        fotoUrl: gtk?.photoUrl ?? null,
      },
      jumlahTalenta: g._count._all,
      skor: Number(g._avg.computedScore ?? 0), // AVG computedScore
    };
  });

  // ==== Sorting (server-side, akurat global) ====
  rows.sort((a, b) => {
    const dirMul = sortDir === "asc" ? 1 : -1;

    let cmp = 0;
    if (sortKey === "name") cmp = a.gtk.nama.localeCompare(b.gtk.nama, "id-ID");
    else if (sortKey === "school") cmp = a.gtk.sekolah.localeCompare(b.gtk.sekolah, "id-ID");
    else if (sortKey === "count") cmp = a.jumlahTalenta - b.jumlahTalenta;
    else if (sortKey === "score") cmp = a.skor - b.skor;

    if (cmp !== 0) return cmp * dirMul;

    // tie-breaker stabil
    const t1 = a.gtk.nama.localeCompare(b.gtk.nama, "id-ID");
    if (t1 !== 0) return t1;
    return a.gtk.nik.localeCompare(b.gtk.nik, "id-ID");
  });

  // ==== Pagination setelah grouping ====
  const start = (page - 1) * pageSize;
  const paged = rows.slice(start, start + pageSize);

  return NextResponse.json({
    data: paged,
    page,
    pageSize,
    total: totalGroups,
    totalPages: Math.max(1, Math.ceil(totalGroups / pageSize)),
    sort: sortKey,
    dir: sortDir,
  });
}
