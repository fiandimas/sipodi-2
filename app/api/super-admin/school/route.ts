import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return jsonError(401, "Unauthorized");
  }

  const schools = await prisma.school.findMany({
    select: { npsn: true, name: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ data: schools });
}
