import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

function contentTypeFromExt(ext: string) {
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!filename || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(
    process.cwd(),
    "storage",
    "uploads",
    "gtk-avatar",
    filename
  );

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentTypeFromExt(ext),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
