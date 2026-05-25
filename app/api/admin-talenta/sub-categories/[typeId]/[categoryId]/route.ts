import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ typeId: string; categoryId: string }>;
  }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_TALENTA") {
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
      select: { id: true, fieldId: true },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan" },
        { status: 404 }
      );
    }

    const typeFieldExists = await prisma.talentTypeField.findUnique({
      where: {
        typeId_fieldId: {
          typeId,
          fieldId: category.fieldId,
        },
      },
    });

    if (!typeFieldExists) {
      return NextResponse.json(
        { error: "Kategori tidak terhubung dengan jenis talenta ini" },
        { status: 400 }
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
        { error: "Anda tidak memiliki akses ke sub kategori ini" },
        { status: 403 }
      );
    }

    const subCategoriesRaw = await prisma.talentSubCategory.findMany({
      where: {
        categoryId,
        isActive: true,
      },
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
    console.error("GET ADMIN-TALENTA SUB CATEGORY ERROR:", err);
    return NextResponse.json(
      { error: "Gagal memuat sub kategori" },
      { status: 500 }
    );
  }
}
