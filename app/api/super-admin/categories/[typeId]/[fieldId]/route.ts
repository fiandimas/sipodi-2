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
  const session = await getSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { typeId, fieldId } = await params;

  try {
    const exists = await prisma.talentTypeField.findUnique({
      where: {
        typeId_fieldId: { typeId, fieldId },
      },
    });

    if (!exists) {
      return NextResponse.json(
        { error: "Bidang tidak terkait dengan jenis talenta ini" },
        { status: 404 }
      );
    }

    const categoriesRaw = await prisma.talentCategory.findMany({
      where: { fieldId, isActive: true },
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

    const categories = categoriesRaw.map((cat) => {
      const subCount = cat.subCategories.length;

      const tagCount = cat.subCategories.reduce(
        (sum, sc) => sum + sc.scopedTags.length,
        0
      );

      const submissionCount =
        cat.submissionCategories.length +
        cat.subCategories.reduce(
          (sum, sc) => sum + sc.submissionSubCategories.length,
          0
        );

      return {
        id: cat.id,
        name: cat.name,
        isActive: cat.isActive,
        fieldId: cat.fieldId,
        _count: {
          subCategories: subCount,
          tags: tagCount,
          submissions: submissionCount,
        },
      };
    });

    return NextResponse.json({ categories });
  } catch (e) {
    console.error("GET categories error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
