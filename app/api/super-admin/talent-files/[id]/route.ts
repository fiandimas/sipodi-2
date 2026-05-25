import { prisma } from "@/app/_lib/prisma"
import { getSession } from "@/app/_lib/session"
import { NextResponse } from "next/server"

function safeFilename(name: string) {
  return (name || "file")
    .replaceAll('"', "")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ")
    .slice(0, 180)
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession()

  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await ctx.params

  if (!id) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 })
  }

  const file = await prisma.talentFile.findUnique({
    where: { id },
    select: {
      data: true,
      mimeType: true,
      originalName: true,
    },
  })

  if (!file) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 })
  }

  const filename = safeFilename(file.originalName)

  return new Response(file.data, {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}