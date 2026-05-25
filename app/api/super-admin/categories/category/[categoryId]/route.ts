import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

type Context = {
  params: Promise<{ categoryId: string }>;
};

export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await getSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { categoryId } = await params;

  const body = await req.json().catch(() => null) as {
    name?: string;
    isActive?: boolean;
  } | null;

  const name = body?.name?.trim();

  if (!name && body?.isActive === undefined) {
    return NextResponse.json(
      { error: "Tidak ada data untuk diperbarui" },
      { status: 400 }
    );
  }

  try {
    const category = await prisma.talentCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, fieldId: true }
    });

    if (!category) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan" },
        { status: 404 }
      );
    }

    if (name) {
      const dup = await prisma.talentCategory.findFirst({
        where: {
          fieldId: category.fieldId,
          name: { equals: name, mode: "insensitive" },
          id: { not: categoryId }
        }
      });

      if (dup) {
        return NextResponse.json(
          { error: "Nama kategori sudah digunakan di bidang ini" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.talentCategory.update({
      where: { id: categoryId },
      data: {
        name: body?.name,
        isActive: body?.isActive,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        updatedAt: true,
        _count: { select: { subCategories: true } }
      }
    });

    return NextResponse.json({ category: updated });

  } catch (e) {
    console.error("PATCH category error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const session = await getSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { categoryId } = await params;

  try {
    const category = await prisma.talentCategory.findUnique({
      where: { id: categoryId },
      select: { id: true }
    });

    if (!category) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan" },
        { status: 404 }
      );
    }

    const subCount = await prisma.talentSubCategory.count({
      where: { categoryId }
    });

    if (subCount > 0) {
      return NextResponse.json(
        {
          error: "Kategori tidak bisa dihapus karena memiliki sub kategori."
        },
        { status: 409 }
      );
    }

    const submissionCount = await prisma.talentSubmissionCategory.count({
      where: { categoryId }
    });

    if (submissionCount > 0) {
      return NextResponse.json(
        {
          error: "Kategori tidak bisa dihapus karena digunakan di submission."
        },
        { status: 409 }
      );
    }

    await prisma.talentTypeCategory.deleteMany({
      where: { categoryId }
    });

    await prisma.talentCategory.delete({
      where: { id: categoryId }
    });

    return NextResponse.json({ success: true });

  } catch (e) {
    console.error("DELETE category error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
