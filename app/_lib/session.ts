import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";

const COOKIE_NAME = "sipodi_session";

export type SessionTalentField = {
  id: string;
  name: string;
};

export type SessionPayload = {
  sub: string;
  role: UserRole;
  branchId: string | null;
  schoolNpsn: string | null;
  gtkNik: string | null;

  // ganti single fieldId -> list bidang
  talentFields: SessionTalentField[];
};

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    return jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "sipodi",
      audience: "sipodi-web",
    }) as SessionPayload;
  } catch {
    return null;
  }
}
