import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ subCategoryId: string }> }
) {
  const { subCategoryId } = await params;

  const session = await getSession();
  if (!session || session.role !== "ADMIN_TALENTA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const name = body?.name?.trim();

    if (!name) {
      return NextResponse.json(
        { error: "Nama sub kategori tidak boleh kosong" },
        { status: 400 }
      );
    }

    const subCategory = await prisma.talentSubCategory.findUnique({
      where: { id: subCategoryId },
      select: {
        id: true,
        name: true,
        categoryId: true,
        category: {
          select: { fieldId: true },
        },
      },
    });

    if (!subCategory) {
      return NextResponse.json(
        { error: "Sub kategori tidak ditemukan" },
        { status: 404 }
      );
    }

    const allowed = await prisma.userTalentField.findFirst({
      where: {
        userId: session.sub,
        fieldId: subCategory.category.fieldId,
      },
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses untuk mengubah sub kategori ini" },
        { status: 403 }
      );
    }

    const duplicate = await prisma.talentSubCategory.findFirst({
      where: {
        categoryId: subCategory.categoryId,
        name: { equals: name, mode: "insensitive" },
        id: { not: subCategoryId },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Nama sub kategori sudah digunakan dalam kategori ini" },
        { status: 409 }
      );
    }

    const updated = await prisma.talentSubCategory.update({
      where: { id: subCategoryId },
      data: { name },
      select: {
        id: true,
        name: true,
        categoryId: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ subCategory: updated });
  } catch (err) {
    console.error("PATCH ADMIN TALENTA SUBCATEGORY ERROR:", err);
    return NextResponse.json(
      { error: "Gagal mengubah sub kategori" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ subCategoryId: string }> }
) {
  const { subCategoryId } = await params;

  const session = await getSession();
  if (!session || session.role !== "ADMIN_TALENTA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subCategory = await prisma.talentSubCategory.findUnique({
      where: { id: subCategoryId },
      select: {
        id: true,
        category: {
          select: { fieldId: true },
        },
        submissionSubCategories: true,
        scopedTags: true,
        typeSubCategories: true,
      },
    });

    if (!subCategory) {
      return NextResponse.json(
        { error: "Sub kategori tidak ditemukan" },
        { status: 404 }
      );
    }

    const allowed = await prisma.userTalentField.findFirst({
      where: {
        userId: session.sub,
        fieldId: subCategory.category.fieldId,
      },
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses untuk menghapus sub kategori ini" },
        { status: 403 }
      );
    }

    if (subCategory.submissionSubCategories.length > 0) {
      return NextResponse.json(
        { error: "Sub kategori tidak dapat dihapus karena masih dipakai oleh submission." },
        { status: 409 }
      );
    }

    if (subCategory.scopedTags.length > 0) {
      return NextResponse.json(
        { error: "Sub kategori tidak dapat dihapus karena masih memiliki Tag." },
        { status: 409 }
      );
    }

    await prisma.talentTypeSubCategory.deleteMany({
      where: { subCategoryId },
    });

    await prisma.talentSubCategory.delete({
      where: { id: subCategoryId },
    });

    return NextResponse.json(
      { message: "Sub kategori berhasil dihapus" },
      { status: 200 }
    );
  } catch (err) {
    console.error("DELETE ADMIN TALENTA SUBCATEGORY ERROR:", err);
    return NextResponse.json(
      { error: "Gagal menghapus sub kategori" },
      { status: 500 }
    );
  }
}
