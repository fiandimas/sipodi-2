// app/api/admin-talenta/fields/[typeId]/route.ts
import { prisma } from "@/app/_lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/_lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ typeId: string }> }
) {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN_TALENTA") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { typeId } = await params;

    const typeExists = await prisma.talentType.findUnique({
      where: { id: typeId },
      select: { id: true },
    });

    if (!typeExists) {
      return NextResponse.json(
        { error: "Jenis talenta tidak ditemukan" },
        { status: 404 }
      );
    }

    const allowedFields = await prisma.userTalentField.findMany({
      where: { userId: session.sub },
      select: { fieldId: true },
    });

    const allowedFieldIds = allowedFields.map((f) => f.fieldId);

    if (allowedFieldIds.length === 0) {
      return NextResponse.json({ fields: [] });
    }

    const typeFields = await prisma.talentTypeField.findMany({
      where: {
        typeId,
        fieldId: { in: allowedFieldIds },
        isActive: true,
        field: { isActive: true },
      },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            isActive: true,

            categories: {
              where: { isActive: true },
              select: {
                id: true,
                subCategories: {
                  where: { isActive: true },
                  select: {
                    id: true,
                    scopedTags: {
                      where: { isActive: true },
                      select: { id: true },
                    },
                  },
                },
              },
            },

            submissionFields: {
              select: { submissionId: true },
            },
          },
        },
      },
      orderBy: {
        field: { name: "asc" },
      },
    });

    const fields = typeFields.map((tf) => {
      const categories = tf.field.categories;

      const totalSubCategories = categories.reduce(
        (sum, c) => sum + c.subCategories.length,
        0
      );

      const totalTags = categories.reduce(
        (tagSum, c) =>
          tagSum +
          c.subCategories.reduce(
            (scSum, sc) => scSum + sc.scopedTags.length,
            0
          ),
        0
      );

      const totalSubmissions = tf.field.submissionFields.length;

      return {
        id: tf.field.id,
        name: tf.field.name,
        isActive: tf.field.isActive,
        _count: {
          categories: categories.length,
          subCategories: totalSubCategories,
          tags: totalTags,
          submissions: totalSubmissions,
        },
      };
    });

    return NextResponse.json({ fields });
  } catch (error) {
    console.error("GET /admin-talenta/fields/[typeId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
