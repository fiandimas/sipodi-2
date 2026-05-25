import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ fileId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_SEKOLAH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schoolNpsn = session.schoolNpsn;
    if (!schoolNpsn) {
      return NextResponse.json(
        { error: "Admin sekolah belum terikat sekolah" },
        { status: 400 }
      );
    }

    const { fileId } = await ctx.params;

    // Ambil file + pastikan file -> submission -> gtk -> schoolNpsn = sekolah admin ini
    const file = await prisma.talentFile.findFirst({
      where: {
        id: fileId,
        submission: {
          gtk: { schoolNpsn },
        },
      },
      select: {
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        data: true,
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", file.mimeType || "application/octet-stream");
    // inline = bisa kebuka di tab baru untuk pdf/gambar; browser tetap bisa download
    headers.set(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.originalName || "file")}"` // aman untuk spasi
    );
    headers.set("Content-Length", String(file.sizeBytes ?? file.data.length));

    // Prisma Bytes biasanya Buffer (Node) -> bisa langsung dipakai ke Response
    return new Response(file.data, { status: 200, headers });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
