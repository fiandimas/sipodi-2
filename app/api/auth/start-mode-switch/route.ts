import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getSession } from "@/app/_lib/session";

const COOKIE_PENDING = "sipodi_pending_login";
const COOKIE_SESSION = "sipodi_session";

const JWT_ISSUER = "sipodi";
const JWT_AUDIENCE = "sipodi-web";

export async function POST(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "JWT_SECRET belum diset di .env" }, { status: 500 });
    }

    // buat pending token dari user yang sedang login (tanpa role/scope final)
    const pendingToken = jwt.sign(
      { sub: session.sub, typ: "pending_switch" },
      secret,
      {
        algorithm: "HS256",
        expiresIn: "10m",
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }
    );

    const res = NextResponse.json({ ok: true });

    const secure = process.env.COOKIE_SECURE === "true" && process.env.NODE_ENV === "production";

    // set pending switch
    res.cookies.set({
      name: COOKIE_PENDING,
      value: pendingToken,
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    // (opsional) kalau Anda mau: jangan hapus session lama di sini.
    // Session lama tetap valid sampai user memilih mode baru.
    // Kalau ingin lebih ketat, uncomment ini untuk menghapus:
    /*
    res.cookies.set({
      name: COOKIE_SESSION,
      value: "",
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    */

    return res;
  } catch (e) {
    console.error("POST /api/auth/start-mode-switch error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
