// app/api/admin-talenta/talent-submissions/[id]/reject/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { DecisionScope, ScoreEntryType, TalentSubmissionStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN_TALENTA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const bodyData = await req.json().catch(() => ({} as any));
  const note = bodyData.note?.trim() || "";

  if (!note) {
    return NextResponse.json(
      { error: "Catatan penolakan wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ✅ GOD MODE - HANYA cek ID exists!
      const submission = await tx.talentSubmission.findUnique({
        where: { id },
        select: { id: true, status: true }
      });

      if (!submission) {
        return {
          ok: false as const,
          error: "Submission tidak ditemukan",
          status: 404
        };
      }

      // ✅ OVERRIDE SEMUA status (PENDING/VERIFIED/approved sekolah)
      await tx.talentSubmission.update({
        where: { id },
        data: {
          status: TalentSubmissionStatus.REJECTED,
          rejectedById: session.sub,
          rejectedAt: new Date(),
          rejectionNote: note,
          rejectedScope: DecisionScope.TALENTA,
          
          approvedById: null,
          approvedAt: null,
          approvalNote: null,
          approvedScope: null,
          superApprovedById: null,
          superApprovedAt: null,
          superApprovalNote: null,
        },
      });

      await tx.talentScoreEntry.create({
        data: {
          submissionId: id,
          type: ScoreEntryType.ADJUSTMENT,
          points: 0,
          createdById: session.sub,
          note: `REJECT(TALENTA-OVERRIDE): ${note}`,
        },
      });

      return { ok: true as const };
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: result.status });
    }

    return NextResponse.json({ ok: true, status: "REJECTED" });
  } catch (e) {
    console.error('Reject error:', e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
