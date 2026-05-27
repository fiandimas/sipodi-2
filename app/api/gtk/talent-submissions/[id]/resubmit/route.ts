import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    const gtkNik = session?.gtkNik;

    if (!gtkNik) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Content-Type harus multipart/form-data" }, { status: 400 });
    }

    const { id } = await ctx.params;

    const fd = await req.formData();

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

      if (submission.status !== "REJECTED") {
        return { ok: true as const };
      }

      // update dari sini
      const activityName = String(fd.get("activityName") ?? "").trim();
      const organizer = String(fd.get("organizer") ?? "").trim();
      const description = String(fd.get("description") ?? "").trim();
      const linkPendukung = String(fd.get("linkPendukung") ?? "").trim();

      if (!activityName) {
        return { ok: false as const, status: 400 as const, error: "activityName wajib diisi" };
      }

      const file = fd.get("file");
      if (file && file instanceof File) {
        const sizeBytes = file.size;
        const mimeType = file.type || "application/octet-stream";
        const originalName = file.name || "upload";

        const allowedTypes = [
          "image/png",
          "image/jpeg",
          "image/jpg",
          "application/pdf",
        ];

        if (!allowedTypes.includes(mimeType)) {
          return NextResponse.json(
            { error: "File harus berupa JPG, PNG, atau PDF" },
            { status: 400 }
          );
        }

        const MAX = 2 * 1024 * 1024;
        if (sizeBytes > MAX) {
          return NextResponse.json(
            { error: "Ukuran file terlalu besar (maks 2MB)" },
            { status: 400 }
          );
        }

        await tx.talentFile.deleteMany({ where: { submissionId: id } });
        await tx.talentFile.create({
          data: {
            submissionId: id,
            data: new Uint8Array(await file.arrayBuffer()),
            originalName: file.name || "upload",
            mimeType: file.type,
            sizeBytes: file.size,
          },
        });
      }

      await tx.talentSubmission.update({
        where: { id },
        data: {
          activityName,
          organizer: organizer || null,
          description: description || null,
          linkPendukung: linkPendukung || null,

          status: "PENDING",

          rejectedScope: null,
          rejectedById: null,
          rejectedAt: null,
          rejectionNote: null,

          approvedScope: null,
          approvedById: null,
          approvedAt: null,
          approvalNote: null,

          adminScore: 0,
          computedScore: 0,

          updatedAt: new Date(),
        },
      });

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
