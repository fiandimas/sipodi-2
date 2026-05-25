import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ subCategoryId: string }> }
) {
  const { subCategoryId } = await params;

  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Nama sub kategori tidak boleh kosong" },
        { status: 400 }
      );
    }

    const subCategory = await prisma.talentSubCategory.findUnique({
      where: { id: subCategoryId },
    });

    if (!subCategory) {
      return NextResponse.json(
        { error: "Sub kategori tidak ditemukan" },
        { status: 404 }
      );
    }

    const exists = await prisma.talentSubCategory.findFirst({
      where: {
        categoryId: subCategory.categoryId,
        name: name.trim(),
        NOT: { id: subCategoryId },
      }
    });

    if (exists) {
      return NextResponse.json(
        { error: "Nama sub kategori sudah digunakan" },
        { status: 409 }
      );
    }

    const updated = await prisma.talentSubCategory.update({
      where: { id: subCategoryId },
      data: { name: name.trim() },
    });

    return NextResponse.json({ subCategory: updated });
  } catch (err) {
    console.error("PATCH SUBCATEGORY ERROR:", err);
    return NextResponse.json(
      { error: "Gagal mengubah sub kategori" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ subCategoryId: string }> }
) {
  const { subCategoryId } = await params;

  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subCategory = await prisma.talentSubCategory.findUnique({
      where: { id: subCategoryId },
      include: {
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

    if (subCategory.submissionSubCategories.length > 0) {
      return NextResponse.json(
        { error: "Tidak dapat menghapus: sudah dipakai dalam submission" },
        { status: 409 }
      );
    }

    if (subCategory.scopedTags.length > 0) {
      return NextResponse.json(
        { error: "Tidak dapat menghapus: masih memiliki Tag" },
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
    console.error("DELETE SUBCATEGORY ERROR:", err);
    return NextResponse.json(
      { error: "Gagal menghapus sub kategori" },
      { status: 500 }
    );
  }
}
