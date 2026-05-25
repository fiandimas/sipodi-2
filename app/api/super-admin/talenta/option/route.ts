import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [kategoriRows, jenisRows] = await Promise.all([
    prisma.talentCategory.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.talentType.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    kategori: kategoriRows.map((x) => x.name).filter(Boolean),
    jenis: jenisRows.map((x) => x.name).filter(Boolean),
  });
}
