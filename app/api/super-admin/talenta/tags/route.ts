// app/api/super-admin/talenta/tags/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { Prisma, TalentSubmissionStatus, DecisionScope } from "@prisma/client";

const PRIORITY_NAMES = ["Juara 1", "Juara 2", "Juara 3"] as const;

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // base dataset super-admin (samakan dengan route talenta kamu)
  const baseWhere = Prisma.sql`
    (
      (ts."status" = ${TalentSubmissionStatus.APPROVED}
        AND ts."approvedScope" IN (${DecisionScope.SEKOLAH}, ${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})
      )
      OR
      (ts."status" = ${TalentSubmissionStatus.REJECTED}
        AND ts."rejectedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})
      )
    )
  `;

  const [others, subs] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; name: string; usedCount: number }>>(Prisma.sql`
      SELECT
        t."id"::text AS id,
        t."name"::text AS name,
        COUNT(*)::int AS "usedCount"
      FROM "talent_tags" t
      JOIN "_TalentSubmissionToTalentTag" j ON j."B" = t."id"
      JOIN "talent_submissions" ts ON ts."id" = j."A"
      WHERE (${baseWhere})
        AND t."name" NOT IN (${Prisma.join(PRIORITY_NAMES)})
      GROUP BY t."id", t."name"
      ORDER BY COUNT(*) DESC, t."name" ASC
      LIMIT 200
    `),
  
    prisma.$queryRaw<Array<{ tagsOtherText: string[] | null }>>(Prisma.sql`
      SELECT ts."tagsOtherText"
      FROM "talent_submissions" ts
      WHERE (${baseWhere})
    `),
  ]);
  
  const freeCounts = new Map<string, number>();
  for (const row of subs) {
    for (const raw of row.tagsOtherText ?? []) {
      const name = String(raw ?? "").trim();
      if (!name) continue;
      if (PRIORITY_NAMES.includes(name as any)) continue;
      freeCounts.set(name, (freeCounts.get(name) ?? 0) + 1);
    }
  }
  
  const free = Array.from(freeCounts, ([name, usedCount]) => ({ name, usedCount }))
    .sort((a, b) => (b.usedCount - a.usedCount) || a.name.localeCompare(b.name))
    .slice(0, 200);
  
  return NextResponse.json({
    priority: PRIORITY_NAMES.map((name) => ({ id: name, name })),
    others,
    free,
  });  
}