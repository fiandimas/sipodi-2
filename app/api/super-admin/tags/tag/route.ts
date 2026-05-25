import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as {
      typeId?: string;
      subCategoryId?: string;
      name?: string;
    } | null;

    const typeId = body?.typeId;
    const subCategoryId = body?.subCategoryId;
    const name = body?.name?.trim();

    if (!typeId || !subCategoryId || !name) {
      return NextResponse.json(
        { error: "typeId, subCategoryId, dan name wajib diisi" },
        { status: 400 }
      );
    }

    const subC = await prisma.talentSubCategory.findUnique({
      where: { id: subCategoryId }
    });

    if (!subC) {
      return NextResponse.json(
        { error: "Subkategori tidak ditemukan" },
        { status: 404 }
      );
    }

    const relation = await prisma.talentTypeSubCategory.findFirst({
      where: { typeId, subCategoryId, isActive: true }
    });

    if (!relation) {
      return NextResponse.json(
        { error: "Subkategori ini tidak terkait dengan jenis talenta tersebut" },
        { status: 400 }
      );
    }

    let tag = await prisma.talentTag.findUnique({
      where: { name }
    });

    if (!tag) {
      tag = await prisma.talentTag.create({
        data: { name }
      });
    }

    else if (!tag.isActive) {
      tag = await prisma.talentTag.update({
        where: { id: tag.id },
        data: { isActive: true }
      });
    }

    const scopeExist = await prisma.talentTypeSubCategoryTag.findUnique({
      where: {
        typeId_subCategoryId_tagId: {
          typeId,
          subCategoryId,
          tagId: tag.id
        }
      }
    });

    if (scopeExist) {
      return NextResponse.json(
        { error: "Tag sudah digunakan pada subkategori ini" },
        { status: 409 }
      );
    }

    await prisma.talentTypeSubCategoryTag.create({
      data: {
        typeId,
        subCategoryId,
        tagId: tag.id
      }
    });

    return NextResponse.json(
      {
        success: true,
        tag: {
          id: tag.id,
          name: tag.name,
          isActive: tag.isActive
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("POST TAG ERROR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
