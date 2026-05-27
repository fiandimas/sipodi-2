import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    const gtkNik = session?.gtkNik;

    if (!gtkNik) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({} as any));

    const result = await prisma.$transaction(async (tx) => {
      // ✅ pastikan submission milik scope ini
      const submission = await tx.talentSubmission.findFirst({
        where: {
          id,
          gtkNik,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!submission) {
        return { ok: false as const, status: 404 as const, error: "Data tidak ditemukan" };
      }

      if (submission.status !== "PENDING") {
        return { ok: true as const };
      }

      await tx.talentSubmissionField.deleteMany({ where: { submissionId: id } });
      await tx.talentSubmissionCategory.deleteMany({ where: { submissionId: id } });
      await tx.talentSubmissionSubCategory.deleteMany({ where: { submissionId: id } });
      await tx.talentFile.deleteMany({ where: { submissionId: id } });
      await tx.talentSubmission.delete({ where: { id } });

      return { ok: true as const };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
