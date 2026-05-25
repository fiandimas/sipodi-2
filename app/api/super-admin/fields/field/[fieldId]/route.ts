import { prisma } from "@/app/_lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/_lib/session";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ fieldId: string }> }
) {
  const session = await getSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { fieldId } = await context.params;

    const body = await req.json().catch(() => null) as {
      name?: string;
      isActive?: boolean;
    } | null;

    if (!body?.name && body?.isActive === undefined) {
      return NextResponse.json(
        { error: "Tidak ada data untuk diperbarui" },
        { status: 400 }
      );
    }

    const exists = await prisma.talentField.findUnique({
      where: { id: fieldId },
      select: { id: true },
    });

    if (!exists) {
      return NextResponse.json(
        { error: "Bidang tidak ditemukan" },
        { status: 404 }
      );
    }

    if (body.name) {
      const dup = await prisma.talentField.findFirst({
        where: {
          id: { not: fieldId },
          name: { equals: body.name, mode: "insensitive" },
        },
      });
      if (dup) {
        return NextResponse.json(
          { error: "Nama bidang sudah digunakan" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.talentField.update({
      where: { id: fieldId },
      data: {
        name: body.name,
        isActive: body.isActive,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ field: updated });
  } catch (e) {
    console.error("PATCH field error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ fieldId: string }> }
) {
  const session = await getSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { fieldId } = await context.params;

    const field = await prisma.talentField.findUnique({
      where: { id: fieldId },
      select: { id: true },
    });

    if (!field) {
      return NextResponse.json(
        { error: "Bidang tidak ditemukan" },
        { status: 404 }
      );
    }

    const categoryCount = await prisma.talentCategory.count({
      where: { fieldId },
    });

    const submissionFieldCount = await prisma.talentSubmissionField.count({
      where: { fieldId },
    });

    if (categoryCount > 0 || submissionFieldCount > 0) {
      return NextResponse.json(
        {
          error:
            "Bidang tidak bisa dihapus karena sudah digunakan di kategori atau submission.",
        },
        { status: 409 }
      );
    }

    await prisma.talentTypeField.deleteMany({
      where: { fieldId },
    });

    await prisma.talentField.delete({
      where: { id: fieldId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE field error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
