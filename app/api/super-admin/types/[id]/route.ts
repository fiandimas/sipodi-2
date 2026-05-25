import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();

  if (!name) {
    return NextResponse.json(
      { error: "Nama jenis talenta wajib diisi" },
      { status: 400 }
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
    },
  });

  return NextResponse.json({ type: updated });
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const type = await prisma.talentType.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!type) {
    return NextResponse.json(
      { error: "Jenis talenta tidak ditemukan" },
      { status: 404 }
    );
  }

  const fieldCount = await prisma.talentTypeField.count({
    where: { typeId: id },
  });

  const categoryCount = await prisma.talentTypeCategory.count({
    where: { typeId: id },
  });

  const subCategoryCount = await prisma.talentTypeSubCategory.count({
    where: { typeId: id },
  });

  const tagCount = await prisma.talentTypeSubCategoryTag.count({
    where: { typeId: id },
  });

  const submissionCount = await prisma.talentSubmission.count({
    where: { typeId: id },
  });

  if (
    fieldCount > 0 ||
    categoryCount > 0 ||
    subCategoryCount > 0 ||
    tagCount > 0 ||
    submissionCount > 0
  ) {
    return NextResponse.json(
      {
        error:
          "Jenis talenta tidak bisa dihapus karena masih memiliki relasi bidang, kategori, sub kategori, tag, atau submission.",
      },
      { status: 409 }
    );
  }

  await prisma.talentTypeField.deleteMany({ where: { typeId: id } });
  await prisma.talentTypeCategory.deleteMany({ where: { typeId: id } });
  await prisma.talentTypeSubCategory.deleteMany({ where: { typeId: id } });
  await prisma.talentTypeSubCategoryTag.deleteMany({ where: { typeId: id } });

  await prisma.talentType.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
