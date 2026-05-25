import { NextResponse } from "next/server";

const COOKIE_PENDING = "sipodi_pending_login";

export async function POST() {
  try {
    const res = NextResponse.json({ ok: true });

    const secure =
      process.env.COOKIE_SECURE === "true" &&
      process.env.NODE_ENV === "production";

    res.cookies.set({
      name: COOKIE_PENDING,
      value: "",
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (e) {
    console.error("POST /api/auth/cancel-pending error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
