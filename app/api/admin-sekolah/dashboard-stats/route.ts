import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { TalentSubmissionStatus } from "@prisma/client";
import { getSession } from "@/app/_lib/session";

export const dynamic = "force-dynamic";

type ChartItem = { label: string; value: number };

function safeDiv(a: number, b: number) {
  return b === 0 ? 0 : a / b;
}

function parseISODate(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// helper membuat filter date gte/lte optional
function buildDateRange(from: Date | null, to: Date | null) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

type ApprovedScopeClient = "SEKOLAH" | "TALENTA" | "SUPER_ADMIN";

const SCOPE_VERIFIED: ApprovedScopeClient = "SEKOLAH";
const SCOPE_SCORED: ApprovedScopeClient[] = ["TALENTA", "SUPER_ADMIN"];

export async function GET(request: NextRequest) {
  const session = await getSession();
  const schoolNpsn = session?.schoolNpsn;
  if (!schoolNpsn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const from = parseISODate(sp.get("from"));
  const to = parseISODate(sp.get("to"));

  // Range B: berdasarkan approvedAt
  const approvedAt = buildDateRange(from, to);
  // Untuk pending/rejected: range pakai createdAt (lebih masuk akal)
  const createdAt = buildDateRange(from, to);

  const school = await prisma.school.findUnique({
    where: { npsn: schoolNpsn },
    select: { npsn: true, name: true, headName: true, headNip: true },
  });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 404 });
  }

  const totalGtk = await prisma.gtk.count({ where: { schoolNpsn } });

  // ===== Chart status (sesuai UI):
  // BELUM_VERIFIKASI -> PENDING (createdAt range)
  // DITINJAU_ULANG  -> REJECTED (createdAt range)
  // TERVERIFIKASI   -> APPROVED + approvedScope SEKOLAH (approvedAt range)
  // DINILAI         -> APPROVED + approvedScope TALENTA/SUPER_ADMIN (approvedAt range)
  const [pendingCount, rejectedCount, verifiedCount, scoredCount] = await Promise.all([
    prisma.talentSubmission.count({
      where: {
        gtk: { schoolNpsn },
        status: TalentSubmissionStatus.PENDING,
        ...(createdAt ? { createdAt } : {}),
      },
    }),
    prisma.talentSubmission.count({
      where: {
        gtk: { schoolNpsn },
        status: TalentSubmissionStatus.REJECTED,
        ...(createdAt ? { createdAt } : {}),
      },
    }),
    prisma.talentSubmission.count({
      where: {
        gtk: { schoolNpsn },
        status: TalentSubmissionStatus.APPROVED,
        approvedScope: SCOPE_VERIFIED as any,
        ...(approvedAt ? { approvedAt } : {}),
      },
    }),
    prisma.talentSubmission.count({
      where: {
        gtk: { schoolNpsn },
        status: TalentSubmissionStatus.APPROVED,
        approvedScope: { in: SCOPE_SCORED as any },
        ...(approvedAt ? { approvedAt } : {}),
      },
    }),
  ]);

  const chartByStatus: ChartItem[] = [
    { label: "DINILAI", value: scoredCount },
    { label: "TERVERIFIKASI", value: verifiedCount },
    { label: "BELUM_VERIFIKASI", value: pendingCount },
    { label: "DITINJAU_ULANG", value: rejectedCount },
  ];

  // ===== Filter utama berdasarkan approvedAt range
  const verifiedWhere = {
    gtk: { schoolNpsn },
    status: TalentSubmissionStatus.APPROVED,
    approvedScope: SCOPE_VERIFIED as any,
    ...(approvedAt ? { approvedAt } : {}),
  };

  const scoredWhere = {
    gtk: { schoolNpsn },
    status: TalentSubmissionStatus.APPROVED,
    approvedScope: { in: SCOPE_SCORED as any },
    ...(approvedAt ? { approvedAt } : {}),
  };

  const totalVerifiedSubmissions = await prisma.talentSubmission.count({
    where: verifiedWhere,
  });

  const approvedByTypeRaw = await prisma.talentSubmission.groupBy({
    by: ["typeId"],
    where: scoredWhere,
    _count: { _all: true },
  });

  const typeIds = approvedByTypeRaw.map((x) => x.typeId);
  const types = await prisma.talentType.findMany({
    where: { id: { in: typeIds } },
    select: { id: true, name: true },
  });
  const typeNameById = new Map(types.map((t) => [t.id, t.name]));

  const chartApprovedByType: ChartItem[] = approvedByTypeRaw
    .map((r) => ({
      label: typeNameById.get(r.typeId) ?? "Jenis (Unknown)",
      value: r._count?._all ?? 0,
    }))
    .sort((a, b) => b.value - a.value);

  const approvedByFieldSubs = await prisma.talentSubmission.findMany({
    where: scoredWhere,
    include: {
      fields: {
        include: {
          field: { select: { id: true, name: true } }
        }
      }
    }
  });

  const fieldCountMap = approvedByFieldSubs.reduce((acc, sub) => {
    sub.fields.forEach(({ field }) => {
      const id = field.id;
      acc[id] = (acc[id] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  // Fetch field names
  const fieldIds = Object.keys(fieldCountMap);
  const fields = fieldIds.length > 0
    ? await prisma.talentField.findMany({
      where: { id: { in: fieldIds } },
      select: { id: true, name: true }
    })
    : [];

  const fieldNameById = new Map(fields.map(f => [f.id, f.name]));

  const chartApprovedByField: ChartItem[] = Object.entries(fieldCountMap).map(([id, count]) => ({
    label: fieldNameById.get(id) ?? "Bidang (Unknown)",
    value: count,
  })).sort((a, b) => b.value - a.value);

  const avgVerifiedTalentaPerGtk = safeDiv(totalVerifiedSubmissions, totalGtk);

  // Score entry hanya untuk submission APPROVED dan ikut approvedAt range (via submission filter)
  const totalScoredPointsAgg = await prisma.talentScoreEntry.aggregate({
    where: {
      submission: {
        gtk: { schoolNpsn },
        status: TalentSubmissionStatus.APPROVED,
        approvedScope: { in: SCOPE_SCORED as any },
        ...(approvedAt ? { approvedAt } : {}),
      },
    },
    _sum: { points: true },
  });

  const totalScoredPoints = totalScoredPointsAgg._sum.points ?? 0;
  const avgScoredPointsPerGtk = safeDiv(totalScoredPoints, totalGtk);

  return NextResponse.json({
    school,
    totalGtk,

    totalVerifiedSubmissions,
    avgVerifiedTalentaPerGtk,
    totalScoredPoints,
    avgScoredPointsPerGtk,

    chartByStatus,
    chartApprovedByType,
    chartApprovedByField,

    range: {
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
      mode: "approvedAt",
    },
  });
}
