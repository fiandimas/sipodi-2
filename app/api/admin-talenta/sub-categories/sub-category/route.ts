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
      select: { id: true, fieldId: true },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan" },
        { status: 404 }
      );
    }

    const relation = await prisma.talentTypeField.findUnique({
      where: {
        typeId_fieldId: {
          typeId,
          fieldId: category.fieldId,
        },
      },
    });

    if (!relation) {
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
        { error: "Anda tidak memiliki akses untuk membuat sub kategori di bidang ini" },
        { status: 403 }
      );
    }

    const exists = await prisma.talentSubCategory.findFirst({
      where: {
        categoryId,
        name: { equals: name, mode: "insensitive" },
      },
    });

    if (exists) {
      return NextResponse.json(
        { error: "Nama sub kategori sudah ada dalam kategori ini" },
        { status: 409 }
      );
    }

    const subCategory = await prisma.talentSubCategory.create({
      data: {
        categoryId,
        name,
        isActive: true,

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

    return NextResponse.json({ subCategory }, { status: 201 });
  } catch (err: any) {
    console.error("POST ADMIN-TALENTA SUBCATEGORY ERROR:", err);

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
