import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { NextResponse } from "next/server";

type Params = {
  params: { tagId: string };
};

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tagId } = await params;

    const body = await req.json().catch(() => null);
    const name = body?.name?.trim();

    if (!name) {
      return NextResponse.json(
        { error: "Nama tag tidak boleh kosong" },
        { status: 400 }
      );
    }

    const exist = await prisma.talentTag.findUnique({
      where: { name },
    });

    if (exist && exist.id !== tagId) {
      return NextResponse.json(
        { error: "Nama tag sudah digunakan" },
        { status: 409 }
      );
    }

    await prisma.talentTag.update({
      where: { id: tagId },
      data: { name },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("PATCH TAG ERROR:", err);
    return NextResponse.json(
      { error: "Gagal mengubah tag" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tagId } = await params;

    const countUsed = await prisma.talentSubmission.count({
      where: {
        tags: { some: { id: tagId } },
      },
    });

    if (countUsed > 0) {
      return NextResponse.json(
        { error: "Tag tidak bisa dihapus karena sudah dipakai submissions" },
        { status: 409 }
      );
    }

    await prisma.talentTypeSubCategoryTag.deleteMany({
      where: { tagId },
    });

    await prisma.talentTag.delete({
      where: { id: tagId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE TAG ERROR:", err);
    return NextResponse.json(
      { error: "Gagal menghapus tag" },
      { status: 500 }
    );
  }
}
