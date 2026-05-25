import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const types = await prisma.talentType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
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
          }
        }
      }
    });

    return NextResponse.json({ types });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { name?: string } | null;
  const name = body?.name?.trim();

  if (!name) {
    return NextResponse.json(
      { error: "Nama jenis talenta wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const type = await prisma.talentType.create({
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
          }
        }
      }
    });

    return NextResponse.json({ type }, { status: 201 });

  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json(
        { error: "Jenis talenta dengan nama ini sudah ada" },
        { status: 409 }
      );
    }

    console.error(e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
