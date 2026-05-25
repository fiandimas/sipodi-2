import { NextResponse } from "next/server"

const COOKIE_NAME = "sipodi_session"

export async function POST() {
  const res = NextResponse.json({ ok: true })

  const secure =
    process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production"

  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  })

  return res
}
