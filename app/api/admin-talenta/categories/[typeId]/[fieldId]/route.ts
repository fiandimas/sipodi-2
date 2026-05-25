import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

type Params = {
  params: Promise<{
    typeId: string;
    fieldId: string;
  }>;
};

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN_TALENTA") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { typeId, fieldId } = await params;

    const allowedField = await prisma.userTalentField.findFirst({
      where: { userId: session.sub, fieldId },
    });

    if (!allowedField) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke bidang ini" },
        { status: 403 }
      );
    }

    const fieldTypeLink = await prisma.talentTypeField.findFirst({
      where: {
        typeId,
        fieldId,
      },
    });

    if (!fieldTypeLink) {
      return NextResponse.json(
        { error: "Bidang ini tidak terhubung dengan jenis talenta tersebut" },
        { status: 404 }
      );
    }

    const categoriesRaw = await prisma.talentCategory.findMany({
      where: {
        fieldId,
        isActive: true,
        typeCategories: { some: { typeId } },
      },
      orderBy: { name: "asc" },

      select: {
        id: true,
        name: true,
        isActive: true,
        fieldId: true,

        subCategories: {
          where: { isActive: true },
          select: {
            id: true,
            scopedTags: { select: { id: true } },
            submissionSubCategories: { select: { submissionId: true } },
          },
        },

        submissionCategories: {
          select: { submissionId: true },
        },
      },
    });

    const categories = categoriesRaw.map((c) => {
      const subCategoryCount = c.subCategories.length;

      const tagCount = c.subCategories.reduce(
        (sum, sc) => sum + sc.scopedTags.length,
        0
      );

      const submissionCount =
        c.submissionCategories.length +
        c.subCategories.reduce(
          (sum, sc) => sum + sc.submissionSubCategories.length,
          0
        );

      return {
        id: c.id,
        name: c.name,
        isActive: c.isActive,
        fieldId: c.fieldId,

        _count: {
          subCategories: subCategoryCount,
          tags: tagCount,
          submissions: submissionCount,
        },
      };
    });

    return NextResponse.json({ categories });
  } catch (err) {
    console.error("GET /admin-talenta/categories ERROR:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
