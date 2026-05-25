// app/api/admin-talenta/categories/category/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN_TALENTA") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      typeId?: string;
      fieldId?: string;
      name?: string;
    } | null;

    if (!body?.typeId || !body?.fieldId || !body?.name?.trim()) {
      return NextResponse.json(
        { error: "typeId, fieldId, dan name wajib diisi" },
        { status: 400 }
      );
    }

    const typeId = body.typeId;
    const fieldId = body.fieldId;
    const name = body.name.trim();

    const allowed = await prisma.userTalentField.findFirst({
      where: { userId: session.sub, fieldId },
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke bidang ini" },
        { status: 403 }
      );
    }

    const relation = await prisma.talentTypeField.findFirst({
      where: { typeId, fieldId },
    });

    if (!relation) {
      return NextResponse.json(
        { error: "Bidang tidak terhubung dengan jenis talenta ini" },
        { status: 400 }
      );
    }

    const duplicate = await prisma.talentTypeCategory.findFirst({
      where: {
        typeId,
        category: {
          fieldId,
          name: { equals: name, mode: "insensitive" },
        },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Nama kategori sudah digunakan pada jenis talenta ini" },
        { status: 409 }
      );
    }

    const category = await prisma.talentCategory.create({
      data: {
        name,
        fieldId,
        isActive: true,
      },
    });

    await prisma.talentTypeCategory.create({
      data: { typeId, categoryId: category.id },
    });

    const subCategories = await prisma.talentSubCategory.findMany({
      where: { categoryId: category.id, isActive: true },
      include: {
        scopedTags: true,
        submissionSubCategories: true,
      },
    });

    const submissionCategories =
      await prisma.talentSubmissionCategory.findMany({
        where: { categoryId: category.id },
      });

    const finalCategory = {
      id: category.id,
      fieldId: category.fieldId,
      name: category.name,
      isActive: category.isActive,
      _count: {
        subCategories: subCategories.length,
        tags: subCategories.reduce(
          (sum, sc) => sum + sc.scopedTags.length,
          0
        ),
        submissions:
          submissionCategories.length +
          subCategories.reduce(
            (sum, sc) => sum + sc.submissionSubCategories.length,
            0
          ),
      },
    };

    return NextResponse.json({ category: finalCategory }, { status: 201 });
  } catch (error) {
    console.error("POST /admin-talenta/categories/category error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
