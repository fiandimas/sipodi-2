import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { ScoreEntryType } from "@prisma/client";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function computeScore(params: { userScore: number; tagScore: number; jenisScore: number; adminScore: number }) {
  const { userScore, tagScore, jenisScore, adminScore } = params;
  return round1(0.2 * userScore + 0.25 * tagScore + 0.25 * jenisScore + 0.3 * adminScore);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_TALENTA") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const body = await req.json().catch(() => ({} as unknown));

    const points = Number((body as any)?.points);
    const note =
      typeof (body as any)?.note === "string" ? (body as any).note.trim() : "";

    if (!Number.isFinite(points)) {
      return NextResponse.json({ error: "Nilai skor tidak valid" }, { status: 400 });
    }
    if (points < 0 || points > 100) {
      return NextResponse.json({ error: "Skor harus antara 0 sampai 100" }, { status: 400 });
    }

    const adminScore = clamp(points, 0, 100);

    const result = await prisma.$transaction(async (tx) => {
      // REPLACE line 46-55:
      const submission = await tx.talentSubmission.findFirst({
        where: {
          id,
          status: "APPROVED",
          fields: {
            some: {
              field: {
                admins: {
                  some: {
                    userId: session.sub
                  }
                }
              }
            }
          }
        },
        select: {
          id: true,
          userScore: true,
          tagScore: true,
          jenisScore: true,
          approvedScope: true,
        },
      });

      if (!submission) {
        return {
          ok: false as const,
          status: 404 as const,
          error: "Data tidak ditemukan / belum approved sekolah / bukan bidang Anda",
        };
      }

      if (
        submission.approvedScope === "TALENTA" ||
        submission.approvedScope === "SUPER_ADMIN"
      ) {
        return {
          ok: true as const,
          adminScore,
          computedScore: null as number | null,
        };
      }

      const userScore = submission.userScore ?? 0;
      const tagScore = submission.tagScore ?? 0;
      const jenisScore = submission.jenisScore ?? 0;

      const computedScore = computeScore({
        userScore,
        tagScore,
        jenisScore,
        adminScore,
      });

      await tx.talentSubmission.update({
        where: { id },
        data: {
          adminScore,
          computedScore,

          approvedScope: "TALENTA",
          approvedById: session.sub,
          approvedAt: new Date(),
          approvalNote: note || null,

          rejectedScope: null,
          rejectedById: null,
          rejectedAt: null,
          rejectionNote: null,
        },
      });

      await tx.talentScoreEntry.create({
        data: {
          submissionId: id,
          type: ScoreEntryType.APPROVAL_SCORE,
          points: Math.round(adminScore),
          createdById: session.sub,
          note: note || null,
        },
      });

      return { ok: true as const, adminScore, computedScore };
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      adminScore: result.adminScore,
      computedScore: result.computedScore,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
