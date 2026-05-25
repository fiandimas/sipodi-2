import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function extFromMime(mime: string) {
  switch (mime) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}

// hanya hapus file yang memang dibuat oleh endpoint ini
function extractLocalAvatarFilename(photoUrl: string | null | undefined) {
  if (!photoUrl) return null;
  const prefix = "/api/gtk/files/gtk-avatar/";
  if (!photoUrl.startsWith(prefix)) return null;
  const filename = photoUrl.slice(prefix.length);
  if (!filename || filename.includes("..") || filename.includes("/"))
    return null;
  return filename;
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.gtkNik || session.role !== "USER_GTK") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File wajib diisi" }, { status: 400 });
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: "Format harus PNG/JPG/WebP" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Ukuran maksimal 2MB" },
        { status: 400 }
      );
    }

    // 1) ambil foto lama dulu
    const current = await prisma.gtk.findUnique({
      where: { nik: session.gtkNik },
      select: { photoUrl: true },
    });

    const oldFilename = extractLocalAvatarFilename(current?.photoUrl);

    // 2) simpan file baru
    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = extFromMime(file.type);

    const safeName =
      crypto.randomBytes(16).toString("hex") + "-" + Date.now() + ext;

    const dir = path.join(process.cwd(), "storage", "uploads", "gtk-avatar");
    await fs.mkdir(dir, { recursive: true });

    const fullPath = path.join(dir, safeName);
    await fs.writeFile(fullPath, bytes);

    console.log("SAVED:", fullPath);

    const url = `/api/gtk/files/gtk-avatar/${safeName}`;

    // 3) update DB ke url baru
    await prisma.gtk.update({
      where: { nik: session.gtkNik },
      data: { photoUrl: url },
    });

    // 4) hapus file lama (best-effort)
    if (oldFilename) {
      const oldPath = path.join(
        process.cwd(),
        "storage",
        "uploads",
        "gtk-avatar",
        oldFilename
      );

      try {
        await fs.unlink(oldPath);
      } catch (e: any) {
        // kalau file sudah tidak ada, abaikan
        if (e?.code !== "ENOENT") {
          console.warn("Failed delete old avatar:", oldPath, e);
        }
      }
    }

    return NextResponse.json({ ok: true, photoUrl: url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
