import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await getSession();

  if (!session || session.role !== "ADMIN_TALENTA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();

  if (!name) {
    return NextResponse.json(
      { error: "Nama jenis talenta wajib diisi" },
      { status: 400 }
    );
  }

  const fieldIds = (
    await prisma.userTalentField.findMany({
      where: { userId: session.sub },
      select: { fieldId: true },
    })
  ).map((f) => f.fieldId);

  const allowed = await prisma.talentTypeField.findFirst({
    where: { typeId: id, fieldId: { in: fieldIds } },
  });

  if (!allowed) {
    return NextResponse.json(
      { error: "Anda tidak memiliki akses ke jenis talenta ini" },
      { status: 403 }
    );
  }

  const duplicate = await prisma.talentType.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      NOT: { id },
    },
  });

  if (duplicate) {
    return NextResponse.json(
      { error: "Jenis talenta dengan nama ini sudah ada" },
      { status: 409 }
    );
  }

  const updated = await prisma.talentType.update({
    where: { id },
    data: { name },
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          typeFields: true,
          typeCategories: true,
          typeSubCategories: true,
          scopedTags: true,
          submissions: true,
        },
      },
    },
  });

  return NextResponse.json({ type: updated });
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const session = await getSession();

  if (!session || session.role !== "ADMIN_TALENTA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const fieldIds = (
    await prisma.userTalentField.findMany({
      where: { userId: session.sub },
      select: { fieldId: true },
    })
  ).map((f) => f.fieldId);

  const allowed = await prisma.talentTypeField.findFirst({
    where: { typeId: id, fieldId: { in: fieldIds } },
  });

  if (!allowed) {
    return NextResponse.json(
      { error: "Anda tidak memiliki akses ke jenis talenta ini" },
      { status: 403 }
    );
  }

  const [categoryCount, subCategoryCount, tagScopeCount, submissionCount] =
    await prisma.$transaction([
      prisma.talentTypeCategory.count({ where: { typeId: id } }),
      prisma.talentTypeSubCategory.count({ where: { typeId: id } }),
      prisma.talentTypeSubCategoryTag.count({ where: { typeId: id } }),
      prisma.talentSubmission.count({ where: { typeId: id } }),
    ]);

  if (categoryCount > 0) {
    return NextResponse.json(
      { error: "Tidak bisa dihapus: masih memiliki kategori." },
      { status: 409 }
    );
  }

  if (subCategoryCount > 0) {
    return NextResponse.json(
      { error: "Tidak bisa dihapus: masih memiliki sub kategori." },
      { status: 409 }
    );
  }

  if (tagScopeCount > 0) {
    return NextResponse.json(
      { error: "Tidak bisa dihapus: masih memiliki tag." },
      { status: 409 }
    );
  }

  if (submissionCount > 0) {
    return NextResponse.json(
      { error: "Tidak bisa dihapus: sudah dipakai submission." },
      { status: 409 }
    );
  }

  // hapus relasi (aman)
  await prisma.talentTypeField.deleteMany({ where: { typeId: id } });
  await prisma.talentType.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
