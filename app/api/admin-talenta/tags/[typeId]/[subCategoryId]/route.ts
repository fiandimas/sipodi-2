import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ typeId: string; subCategoryId: string }>;
};

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_TALENTA") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { typeId, subCategoryId } = await params;

    if (!typeId || !subCategoryId) {
      return NextResponse.json(
        { error: "typeId dan subCategoryId wajib diisi" },
        { status: 400 }
      );
    }

    const subCategory = await prisma.talentSubCategory.findUnique({
      where: { id: subCategoryId },
      select: {
        id: true,
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
        { error: "Anda tidak memiliki akses ke tag dalam sub kategori ini" },
        { status: 403 }
      );
    }

    const mapping = await prisma.talentTypeSubCategory.findFirst({
      where: {
        typeId,
        subCategoryId,
        isActive: true, 
      },
    });

    if (!mapping) {
      return NextResponse.json({ tags: [] }, { status: 200 });
    }

    const scopedTags = await prisma.talentTypeSubCategoryTag.findMany({
      where: {
        typeId,
        subCategoryId,
        isActive: true,
      },
      include: {
        tag: {
          select: {
            id: true,
            name: true,
            isActive: true,
            submissions: { select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const tags = scopedTags.map((t) => ({
      id: t.tag.id,
      name: t.tag.name,
      isActive: t.tag.isActive,
      _count: {
        submissions: t.tag.submissions.length,
      },
    }));

    return NextResponse.json({ tags }, { status: 200 });

  } catch (err) {
    console.error("GET ADMIN TALENTA TAG ERROR:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data tag" },
      { status: 500 }
    );
  }
}