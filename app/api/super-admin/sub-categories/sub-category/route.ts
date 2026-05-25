import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const typeId: string = body?.typeId;
    const categoryId: string = body?.categoryId;
    const name: string = body?.name?.trim();

    if (!typeId || !categoryId || !name) {
      return NextResponse.json(
        { error: "typeId, categoryId, dan name wajib diisi" },
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

    const exists = await prisma.talentSubCategory.findFirst({
      where: { categoryId, name },
    });

    if (exists) {
      return NextResponse.json(
        { error: "Nama sub kategori sudah ada dalam kategori ini" },
        { status: 409 }
      );
    }

    const subCategory = await prisma.talentSubCategory.create({
      data: {
        name,
        categoryId,

        typeSubCategories: {
          create: {
            typeId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        categoryId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      { subCategory },
      { status: 201 }
    );

  } catch (err: any) {
    console.error("POST SUBCATEGORY ERROR:", err);

    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Sub kategori sudah ada" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Gagal membuat sub kategori" },
      { status: 500 }
    );
  }
}
