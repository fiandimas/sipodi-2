import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { DecisionScope, ScoreEntryType, TalentSubmissionStatus } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "ID tidak ditemukan di URL." }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (!note) {
      return NextResponse.json({ error: "Alasan penolakan wajib diisi" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // ✅ boleh reject jika sudah diverifikasi sekolah (SEKOLAH atau TALENTA), tapi belum SUPER_ADMIN
      const submission = await tx.talentSubmission.findFirst({
        where: {
          id,
          status: TalentSubmissionStatus.APPROVED,
          approvedScope: { in: [DecisionScope.SEKOLAH, DecisionScope.TALENTA] },
        },
        select: { id: true },
      });

      if (!submission) {
        return {
          ok: false as const,
          status: 404 as const,
          error: "Data tidak ditemukan / belum diverifikasi sekolah / sudah diproses SUPER_ADMIN",
        };
      }

      await tx.talentSubmission.update({
        where: { id },
        data: {
          status: TalentSubmissionStatus.REJECTED,

          rejectedScope: DecisionScope.SUPER_ADMIN,
          rejectedById: session.sub,
          rejectedAt: new Date(),
          rejectionNote: note,

          // ✅ reset skor super admin
          adminScore: null,
          computedScore: null,

          // ✅ penting: jangan hapus approvedScope sekolah/talenta
          // approvedScope/approvedById/approvedAt BIARKAN agar jejak "terverifikasi" tetap ada
        },
      });

      await tx.talentScoreEntry.create({
        data: {
          submissionId: id,
          type: ScoreEntryType.ADJUSTMENT,
          points: 0,
          createdById: session.sub,
          note: `REJECT(SUPER_ADMIN): ${note}`,
        },
      });

      return { ok: true as const };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, status: "REJECTED" as const });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
