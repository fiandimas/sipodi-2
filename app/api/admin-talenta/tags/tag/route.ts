import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_TALENTA") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);

    const typeId: string | undefined = body?.typeId;
    const subCategoryId: string | undefined = body?.subCategoryId;
    const name: string | undefined = body?.name?.trim();

    if (!typeId || !subCategoryId || !name) {
      return NextResponse.json(
        { error: "typeId, subCategoryId, dan name wajib diisi" },
        { status: 400 }
      );
    }

    const subCategory = await prisma.talentSubCategory.findUnique({
      where: { id: subCategoryId },
      include: {
        category: { select: { id: true, fieldId: true } },
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
        {
          error: "Anda tidak memiliki akses untuk membuat tag pada sub kategori ini",
        },
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
      return NextResponse.json(
        {
          error: "Sub kategori ini tidak terhubung dengan jenis talenta tersebut",
        },
        { status: 400 }
      );
    }

    let tag = await prisma.talentTag.findUnique({
      where: { name },
    });

    if (!tag) {
      tag = await prisma.talentTag.create({
        data: { name },
      });
    } else if (!tag.isActive) {
      tag = await prisma.talentTag.update({
        where: { id: tag.id },
        data: { isActive: true },
      });
    }

    const existScope = await prisma.talentTypeSubCategoryTag.findUnique({
      where: {
        typeId_subCategoryId_tagId: {
          typeId,
          subCategoryId,
          tagId: tag.id,
        },
      },
    });

    if (existScope) {
      return NextResponse.json(
        { error: "Tag sudah digunakan dalam sub kategori ini" },
        { status: 409 }
      );
    }

    await prisma.talentTypeSubCategoryTag.create({
      data: {
        typeId,
        subCategoryId,
        tagId: tag.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        tag: {
          id: tag.id,
          name: tag.name,
          isActive: tag.isActive,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST ADMIN TALENTA TAG ERROR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}