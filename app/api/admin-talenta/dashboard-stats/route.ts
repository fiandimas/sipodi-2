import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { DecisionScope, TalentSubmissionStatus } from "@prisma/client";
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

function buildDateRange(from: Date | null, to: Date | null) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

// definisi sesuai schema Anda (DecisionScope enum)
const SCOPE_VERIFIED = DecisionScope.SEKOLAH;
const SCOPE_SCORED = [DecisionScope.TALENTA, DecisionScope.SUPER_ADMIN];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN_TALENTA" || !session.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const from = parseISODate(sp.get("from"));
  const to = parseISODate(sp.get("to"));

  // range approved untuk metrik/chart dinilai/terverifikasi
  const approvedAt = buildDateRange(from, to);

  // untuk ditinjau ulang: lebih akurat pakai rejectedAt (karena ada di schema)
  const rejectedAt = buildDateRange(from, to);

  // fallback kalau rejectedAt null di data lama (opsional)
  const createdAt = buildDateRange(from, to);

  // bidang yang dipegang admin-talenta ini
  const fieldLinks = await prisma.userTalentField.findMany({
    where: { userId: session.sub },
    select: { fieldId: true },
  });
  const fieldIds = fieldLinks.map((x) => x.fieldId).filter(Boolean);

  // IMPORTANT:
  // Kalau admin-talenta belum punya bidang, jangan hitung global (lebih aman).
  if (fieldIds.length === 0) {
    return NextResponse.json({
      totalGtk: 0,

      totalVerifiedSubmissions: 0,
      avgVerifiedTalentaPerGtk: 0,

      totalScoredSubmissions: 0,
      totalScoredPoints: 0,
      avgScoredPointsPerGtk: 0,

      chartByStatus: [
        { label: "DINILAI", value: 0 },
        { label: "TERVERIFIKASI", value: 0 },
        { label: "DITINJAU_ULANG", value: 0 },
      ] satisfies ChartItem[],

      chartApprovedByType: [] satisfies ChartItem[],
      chartApprovedByField: [] satisfies ChartItem[],

      range: {
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
        mode: "approvedAt",
      },
    });
  }

  const baseFilter = {
    fields: {
      some: {
        fieldId: { in: fieldIds }
      }
    }
  };

  // ===== where helpers
  const verifiedWhere = {
    ...baseFilter,
    status: TalentSubmissionStatus.APPROVED,
    approvedScope: SCOPE_VERIFIED,
    ...(approvedAt ? { approvedAt } : {}),
  };

  const scoredWhere = {
    ...baseFilter,
    status: TalentSubmissionStatus.APPROVED,
    approvedScope: { in: SCOPE_SCORED },
    ...(approvedAt ? { approvedAt } : {}),
  };

  const rejectedWhere = {
    ...baseFilter,
    status: TalentSubmissionStatus.REJECTED,
    rejectedScope: { in: SCOPE_SCORED },
    // pakai rejectedAt kalau ada, fallback createdAt kalau rejectedAt filter kosong
    ...(rejectedAt ? { rejectedAt } : createdAt ? { createdAt } : {}),
  };

  // ===== status chart (3 status)
  const [verifiedCount, scoredCount, rejectedCount] = await Promise.all([
    prisma.talentSubmission.count({ where: verifiedWhere }),
    prisma.talentSubmission.count({ where: scoredWhere }),
    prisma.talentSubmission.count({ where: rejectedWhere }),
  ]);

  const chartByStatus: ChartItem[] = [
    { label: "DINILAI", value: scoredCount },
    { label: "TERVERIFIKASI", value: verifiedCount },
    { label: "DITINJAU_ULANG", value: rejectedCount },
  ];

  // ===== metrik
  const totalVerifiedSubmissions = verifiedCount;
  const totalScoredSubmissions = scoredCount;

  // NOTE:
  // totalGtk saat ini masih global (seperti code Anda).
  // Kalau mau "GTK terkait bidang", butuh definisi relasi GTK<->Bidang (tidak ada di schema).
  const totalGtk = await prisma.gtk.count();

  const avgVerifiedTalentaPerGtk = safeDiv(totalVerifiedSubmissions, totalGtk || 1);

  // ===== chart by type (DINILAI)
  const byType = await prisma.talentSubmission.groupBy({
    by: ["typeId"],
    where: scoredWhere,
    _count: { _all: true },
  });

  const typeIds = byType.map((x) => x.typeId);
  const types = await prisma.talentType.findMany({
    where: { id: { in: typeIds } },
    select: { id: true, name: true },
  });
  const typeName = new Map(types.map((t) => [t.id, t.name]));

  const chartApprovedByType: ChartItem[] = byType
    .map((g) => ({
      label: typeName.get(g.typeId) ?? "Jenis (Unknown)",
      value: g._count?._all ?? 0,
    }))
    .sort((a, b) => b.value - a.value);



  // Manual grouping by field junction table
  const scoredSubs = await prisma.talentSubmission.findMany({
    where: scoredWhere,
    include: {
      fields: {
        include: {
          field: { select: { id: true, name: true } }
        }
      }
    }
  });

  const fieldCountMap = scoredSubs.reduce((acc, sub) => {
    sub.fields.forEach(({ field }) => {
      const id = field.id;
      acc[id] = (acc[id] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  const usedFieldIds = Object.keys(fieldCountMap);
  const fields = usedFieldIds.length > 0
    ? await prisma.talentField.findMany({
      where: { id: { in: usedFieldIds } },
      select: { id: true, name: true }
    })
    : [];
  const fieldName = new Map(fields.map(f => [f.id, f.name]));

  const chartApprovedByField: ChartItem[] = Object.entries(fieldCountMap)
    .map(([id, count]) => ({
      label: fieldName.get(id) ?? "Bidang (Unknown)",
      value: count,
    }))
    .sort((a, b) => b.value - a.value);

  // ===== poin (DINILAI saja)
  const totalScoredPointsAgg = await prisma.talentScoreEntry.aggregate({
    where: {
      submission: scoredWhere, // nested relation filter OK
    },
    _sum: { points: true },
  });

  const totalScoredPoints = totalScoredPointsAgg._sum.points ?? 0;
  const avgScoredPointsPerGtk = safeDiv(totalScoredPoints, totalGtk || 1);

  return NextResponse.json({
    totalGtk,

    totalVerifiedSubmissions,
    avgVerifiedTalentaPerGtk,

    totalScoredSubmissions,
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
