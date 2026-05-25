import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: { typeId: string; categoryId: string };
  }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { typeId, categoryId } = await params;

    if (!typeId || !categoryId) {
      return NextResponse.json(
        { error: "typeId dan categoryId wajib diisi" },
        { status: 400 }
      );
    }

    const category = await prisma.talentCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan" },
        { status: 404 }
      );
    }

    const subCategoriesRaw = await prisma.talentSubCategory.findMany({
      where: { categoryId },
      select: {
        id: true,
        name: true,
        isActive: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,

        _count: {
          select: {
            scopedTags: true,
            submissionSubCategories: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const subCategories = subCategoriesRaw.map((sc) => ({
      id: sc.id,
      name: sc.name,
      isActive: sc.isActive,
      categoryId: sc.categoryId,
      createdAt: sc.createdAt,
      updatedAt: sc.updatedAt,

      _count: {
        tags: sc._count.scopedTags,
        submissions: sc._count.submissionSubCategories,
      },
    }));

    return NextResponse.json({ subCategories }, { status: 200 });
  } catch (err) {
    console.error("GET SUB CATEGORY ERROR:", err);
    return NextResponse.json(
      { error: "Gagal memuat sub kategori" },
      { status: 500 }
    );
  }
}
