import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.gtkNik) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const typeId = searchParams.get('typeId');

    // 1. TYPES ✅
    const typesRaw = await prisma.talentType.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        typeFields: {
          where: { isActive: true },
          select: { fieldId: true }
        }
      },
      orderBy: { name: "asc" }
    });

    const types = typesRaw.map((t: any) => ({
      id: t.id,
      name: t.name,
      allowedFieldIds: t.typeFields.map((tf: any) => tf.fieldId)
    }));

    // 2. FIELDS ✅
    let fields: any[] = [];
    
    if (typeId) {
      const fieldIds = await prisma.talentTypeField.findMany({
        where: { typeId, isActive: true },
        select: { fieldId: true }
      });
      const fieldIdList = fieldIds.map((f: any) => f.fieldId);
      
      fields = await prisma.talentField.findMany({
        where: { 
          id: { in: fieldIdList },
          isActive: true 
        },
        include: {
          categories: {
            where: { isActive: true },
            include: {
              subCategories: {
                where: { isActive: true },
                orderBy: { name: "asc" }
              }
            },
            orderBy: { name: "asc" }
          }
        },
        orderBy: { name: "asc" }
      });
    } else {
      fields = await prisma.talentField.findMany({
        where: { isActive: true },
        include: {
          categories: {
            where: { isActive: true },
            include: {
              subCategories: {
                where: { isActive: true },
                orderBy: { name: "asc" }
              }
            },
            orderBy: { name: "asc" }
          }
        },
        orderBy: { name: "asc" }
      });
    }

    // 3. CLEAN ✅ FIXED
    const fieldsClean = fields
      .map((f: any) => {
        const categories: any[] = (f.categories || []);
        return {
          id: f.id,
          name: f.name,
          categories: categories
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              subCategories: (c.subCategories || [])
            }))
            .filter((c: any) => c.subCategories.length > 0)
        };
      })
      .filter((f: any) => f.categories.length > 0);

    return NextResponse.json({ 
      types, 
      fields: fieldsClean 
    });

  } catch (e) {
    console.error("[talent-master]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
