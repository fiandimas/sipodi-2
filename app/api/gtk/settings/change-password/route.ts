import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { hashPasswordArgon2id, verifyPassword } from "@/app/_lib/password";

export async function PATCH(req: Request) {
  try {
    const session = await getSession();

    // hanya GTK login yang boleh
    if (!session?.sub || session.role !== "USER_GTK") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      oldPassword: string;
      newPassword: string;
      confirmPassword: string;
    };

    if (!body?.oldPassword || !body?.newPassword || !body?.confirmPassword) {
      return NextResponse.json({ error: "Input tidak lengkap" }, { status: 400 });
    }

    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json(
        { error: "Konfirmasi password tidak sama" },
        { status: 400 }
      );
    }

    if (body.newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password minimal 8 karakter" },
        { status: 400 }
      );
    }

    // session.sub diasumsikan = user.id (cuid)
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true, role: true, password: true, passwordAlgo: true },
    });

    if (!user || user.role !== "USER_GTK") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ok = await verifyPassword({
      algo: user.passwordAlgo,
      password: body.oldPassword,
      hash: user.password,
    });

    if (!ok) {
      return NextResponse.json({ error: "Password lama salah" }, { status: 400 });
    }

    const newHash = await hashPasswordArgon2id(body.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHash,
        passwordAlgo: "ARGON2ID",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
