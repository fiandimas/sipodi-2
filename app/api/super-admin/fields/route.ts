// app/api/super-admin/fields/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      typeId?: string;
      name?: string;
    } | null;

    const typeId = body?.typeId;
    const name = body?.name?.trim();

    if (!typeId || !name) {
      return NextResponse.json(
        { error: "typeId dan nama bidang wajib diisi" },
        { status: 400 }
      );
    }

    const type = await prisma.talentType.findUnique({
      where: { id: typeId },
      select: { id: true },
    });

    if (!type) {
      return NextResponse.json(
        { error: "Jenis talenta tidak ditemukan" },
        { status: 404 }
      );
    }

    let field = await prisma.talentField.findUnique({
      where: { name },
    });

    if (!field) {
      field = await prisma.talentField.create({
        data: {
          name,
          isActive: true,
        },
      });
    }

    const relationExists = await prisma.talentTypeField.findUnique({
      where: {
        typeId_fieldId: {
          typeId,
          fieldId: field.id,
        },
      },
    });

    if (relationExists) {
      return NextResponse.json(
        { error: "Bidang ini sudah terhubung dengan jenis talenta tersebut" },
        { status: 409 }
      );
    }

    await prisma.talentTypeField.create({
      data: {
        typeId,
        fieldId: field.id,
      },
    });

    return NextResponse.json(
      {
        field: {
          id: field.id,
          name: field.name,
          isActive: field.isActive,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/super-admin/fields error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
