import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ tagId: string }>;
};

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_TALENTA") {
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

    const tag = await prisma.talentTag.findUnique({
      where: { id: tagId },
    });

    if (!tag) {
      return NextResponse.json(
        { error: "Tag tidak ditemukan" },
        { status: 404 }
      );
    }

    const mapping = await prisma.talentTypeSubCategoryTag.findFirst({
      where: { tagId },
      include: {
        subCategory: {
          include: {
            category: { select: { fieldId: true } },
          },
        },
      },
    });

    if (!mapping) {
      return NextResponse.json(
        {
          error:
            "Tag ini tidak terkait dengan subkategori manapun, tidak dapat diubah oleh Admin Talenta",
        },
        { status: 403 }
      );
    }

    const allowed = await prisma.userTalentField.findFirst({
      where: {
        userId: session.sub,
        fieldId: mapping.subCategory.category.fieldId,
      },
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses untuk mengubah tag ini" },
        { status: 403 }
      );
    }

    const dup = await prisma.talentTag.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        NOT: { id: tagId },
      },
    });

    if (dup) {
      return NextResponse.json(
        { error: "Nama tag sudah digunakan" },
        { status: 409 }
      );
    }

    const updated = await prisma.talentTag.update({
      where: { id: tagId },
      data: { name },
    });

    return NextResponse.json({ tag: updated }, { status: 200 });

  } catch (err) {
    console.error("PATCH ADMIN-TALENTA TAG ERROR:", err);
    return NextResponse.json(
      { error: "Gagal mengubah tag" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_TALENTA") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tagId } = await params;

    const tag = await prisma.talentTag.findUnique({
      where: { id: tagId },
      include: {
        submissions: true,
      },
    });

    if (!tag) {
      return NextResponse.json(
        { error: "Tag tidak ditemukan" },
        { status: 404 }
      );
    }

    const mapping = await prisma.talentTypeSubCategoryTag.findFirst({
      where: { tagId },
      include: {
        subCategory: {
          include: {
            category: { select: { fieldId: true } },
          },
        },
      },
    });

    if (!mapping) {
      return NextResponse.json(
        { error: "Tag ini tidak terkait dengan subkategori apapun" },
        { status: 400 }
      );
    }

    const allowed = await prisma.userTalentField.findFirst({
      where: {
        userId: session.sub,
        fieldId: mapping.subCategory.category.fieldId,
      },
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses untuk menghapus tag ini" },
        { status: 403 }
      );
    }

    if (tag.submissions.length > 0) {
      return NextResponse.json(
        {
          error: "Tag tidak dapat dihapus karena sudah dipakai dalam submissions",
        },
        { status: 409 }
      );
    }

    await prisma.talentTypeSubCategoryTag.deleteMany({
      where: { tagId },
    });

    await prisma.talentTag.delete({
      where: { id: tagId },
    });

    return NextResponse.json(
      { success: true, message: "Tag berhasil dihapus" },
      { status: 200 }
    );

  } catch (err) {
    console.error("DELETE ADMIN-TALENTA TAG ERROR:", err);
    return NextResponse.json(
      { error: "Gagal menghapus tag" },
      { status: 500 }
    );
  }
}

