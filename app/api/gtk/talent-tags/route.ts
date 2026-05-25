// app/api/gtk/talent-tags/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.gtkNik) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const typeId = searchParams.get('typeId');
    const subCategoryId = searchParams.get('subCategoryId');

    if (!typeId || !subCategoryId) {
      return NextResponse.json({ tags: [] });
    }

    // 1. Get scoped tags via TalentTypeSubCategoryTag
    const scopedTags = await prisma.talentTypeSubCategoryTag.findMany({
      where: {
        typeId,
        subCategoryId,
        isActive: true,
        tag: { isActive: true }
      },
      select: {
        tag: {
          select: { id: true, name: true }
        }
      }
    });

    let tags = scopedTags.map(st => st.tag);

    // 2. LOMBA RULES: tambah Juara 1/2/3
    const type = await prisma.talentType.findUnique({
      where: { id: typeId },
      select: { name: true }
    });

    if (type?.name?.includes("Lomba")) {
      const juaraTags = await prisma.talentTag.findMany({
        where: {
          OR: [
            { name: "Juara 1" },
            { name: "Juara 2" },
            { name: "Juara 3" }
          ],
          isActive: true
        },
        select: { id: true, name: true }
      });
      tags.push(...juaraTags);
    }

    // 3. Remove duplicates
    const uniqueTags = Array.from(
      new Map(tags.map(t => [t.id, t])).values()
    );

    return NextResponse.json({ tags: uniqueTags });

  } catch (e) {
    console.error("[talent-tags]", e);
    return NextResponse.json({ tags: [] });
  }
}
