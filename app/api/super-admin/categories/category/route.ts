import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as {
    typeId?: string;
    fieldId?: string;
    name?: string;
  } | null;

  if (!body?.typeId || !body?.fieldId || !body?.name) {
    return NextResponse.json(
      { error: "typeId, fieldId, dan name wajib diisi" },
      { status: 400 }
    );
  }

  const { typeId, fieldId, name } = body;

  try {
    const relation = await prisma.talentTypeField.findUnique({
      where: {
        typeId_fieldId: { typeId, fieldId }
      }
    });

    if (!relation) {
      return NextResponse.json(
        { error: "Bidang tidak terhubung dengan jenis talenta" },
        { status: 400 }
      );
    }

    const exists = await prisma.talentCategory.findFirst({
      where: {
        fieldId,
        name: { equals: name, mode: "insensitive" },
      }
    });

    if (exists) {
      return NextResponse.json(
        { error: "Nama kategori sudah digunakan di bidang ini" },
        { status: 409 }
      );
    }

    const newCategory = await prisma.talentCategory.create({
      data: {
        fieldId,
        name,
      },
      select: {
        id: true,
        fieldId: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { subCategories: true }
        }
      }
    });

    await prisma.talentTypeCategory.upsert({
      where: {
        typeId_categoryId: {
          typeId,
          categoryId: newCategory.id,
        },
      },
      update: {},
      create: {
        typeId,
        categoryId: newCategory.id,
      },
    });

    return NextResponse.json({ category: newCategory }, { status: 201 });

  } catch (e) {
    console.error("POST category error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
