// app/_lib/session-validated.ts
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/app/_lib/prisma";
import type { UserRole } from "@prisma/client";
import type { SessionTalentField } from "./session";

const COOKIE_NAME = "sipodi_session";

type SessionPayload = {
  sub: string;
  ver: number;
  role: UserRole;
  branchId: string | null;
  schoolNpsn: string | null;
  gtkNik: string | null;
  talentFields: SessionTalentField[];
};

export async function getSessionValidated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return { session: null as const, revoked: false };

  const secret = process.env.JWT_SECRET;
  if (!secret) return { session: null as const, revoked: false };

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "sipodi",
      audience: "sipodi-web",
    }) as SessionPayload;

    // ✅ cek ke DB: apakah token masih valid
    const u = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, sessionVersion: true },
    });

    if (!u || !u.isActive) return { session: null as const, revoked: true };
    if (u.sessionVersion !== payload.ver) return { session: null as const, revoked: true };

    return { session: payload, revoked: false };
  } catch {
    return { session: null as const, revoked: true };
  }
}
