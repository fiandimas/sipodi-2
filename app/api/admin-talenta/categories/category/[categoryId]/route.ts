// PATCH /api/admin-talenta/categories/category/[categoryId]

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

type Context = { params: Promise<{ categoryId: string }> };

export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_TALENTA") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { categoryId } = await params;

    const body = (await req.json().catch(() => null)) as {
      name?: string;
      isActive?: boolean;
    } | null;

    if (!body) {
      return NextResponse.json(
        { error: "Tidak ada data untuk diperbarui" },
        { status: 400 }
      );
    }

    const category = await prisma.talentCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, fieldId: true, name: true }
    });

    if (!category) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan" },
        { status: 404 }
      );
    }

    const allowed = await prisma.userTalentField.findFirst({
      where: {
        userId: session.sub,
        fieldId: category.fieldId,
      },
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke kategori ini" },
        { status: 403 }
      );
    }

    const newName = body.name?.trim() || undefined;
    const newStatus = typeof body.isActive === "boolean" ? body.isActive : undefined;

    if (newName && newName.toLowerCase() !== category.name.toLowerCase()) {
      const dup = await prisma.talentCategory.findFirst({
        where: {
          fieldId: category.fieldId,
          name: { equals: newName, mode: "insensitive" },
          id: { not: categoryId },
        },
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
        name: newName,
        isActive: newStatus,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        updatedAt: true,
        _count: { select: { subCategories: true } },
      },
    });

    return NextResponse.json({ category: updated });
  } catch (error) {
    console.error("PATCH admin-talenta category error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_TALENTA") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { categoryId } = await params;

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

    const allowed = await prisma.userTalentField.findFirst({
      where: { userId: session.sub, fieldId: category.fieldId },
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke kategori ini" },
        { status: 403 }
      );
    }

    const subCount = await prisma.talentSubCategory.count({
      where: { categoryId },
    });

    if (subCount > 0) {
      return NextResponse.json(
        { error: "Kategori tidak bisa dihapus karena memiliki sub kategori." },
        { status: 409 }
      );
    }

    const submissionCount = await prisma.talentSubmissionCategory.count({
      where: { categoryId },
    });

    if (submissionCount > 0) {
      return NextResponse.json(
        { error: "Kategori tidak bisa dihapus karena dipakai di submission." },
        { status: 409 }
      );
    }

    await prisma.talentTypeCategory.deleteMany({
      where: { categoryId },
    });

    await prisma.talentCategory.delete({
      where: { id: categoryId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE admin-talenta category error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
