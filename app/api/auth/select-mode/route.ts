import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/app/_lib/prisma";
import { UserRole } from "@prisma/client";


const COOKIE_SESSION = "sipodi_session";
const COOKIE_PENDING = "sipodi_pending_login";


const JWT_ISSUER = "sipodi";
const JWT_AUDIENCE = "sipodi-web";


type Body =
    | { role: "SUPER_ADMIN" }
    | { role: "USER_GTK" }
    | { role: "ADMIN_TALENTA" }
    | { role: "ADMIN_SEKOLAH"; accessId: string };


type PendingPayload = { sub: string; typ?: string };


export async function POST(req: NextRequest) {
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return NextResponse.json({ error: "JWT_SECRET belum diset di .env" }, { status: 500 });
        }


        const pending = req.cookies.get(COOKIE_PENDING)?.value;
        if (!pending) {
            return NextResponse.json(
                { error: "Pending login tidak ditemukan. Silakan login ulang." },
                { status: 401 }
            );
        }


        let pendingPayload: PendingPayload | null = null;
        try {
            pendingPayload = jwt.verify(pending, secret, {
                algorithms: ["HS256"],
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE,
            }) as PendingPayload;
        } catch {
            return NextResponse.json(
                { error: "Pending login kedaluwarsa. Silakan login ulang." },
                { status: 401 }
            );
        }


        if (!pendingPayload?.sub) {
            return NextResponse.json({ error: "Pending login tidak valid." }, { status: 401 });
        }


        const body = (await req.json().catch(() => null)) as Body | null;
        if (!body || !(body as any).role) {
            return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
        }


        // ambil user + relasi minimal
        const user = await prisma.user.findUnique({
            where: { id: pendingPayload.sub },
            select: {
                id: true,
                isActive: true,


                // fallback fields
                role: true,
                branchId: true,
                schoolNpsn: true,
                gtkNik: true,


                talentFields: {
                    select: { field: { select: { id: true, name: true, isActive: true } } },
                },
            },
        });


        if (!user) {
            return NextResponse.json({ error: "User tidak ditemukan." }, { status: 401 });
        }


        if (!user.isActive) {
            return NextResponse.json({ error: "Akun tidak aktif." }, { status: 403 });
        }


        let finalRole: UserRole = body.role as UserRole;
        let branchId: string | null = null;
        let schoolNpsn: string | null = null;
        let gtkNik: string | null = user.gtkNik ?? null;


        const talentFields = (user.talentFields || [])
            .map((x) => x.field)
            .filter((f) => f.isActive)
            .map((f) => ({ id: f.id, name: f.name }));


        if (body.role === "SUPER_ADMIN") {
            const grant = await prisma.userAccess.findFirst({
                where: { userId: user.id, role: "SUPER_ADMIN" },
                select: { id: true },
            });


            // fallback: kalau tidak ada userAccess tapi role di user SUPER_ADMIN, izinkan
            if (!grant && user.role !== "SUPER_ADMIN") {
                return NextResponse.json({ error: "Tidak memiliki akses Super Admin." }, { status: 403 });
            }


            branchId = null;
            schoolNpsn = null;
        }


        if (body.role === "USER_GTK") {
            if (!user.gtkNik) {
                return NextResponse.json({ error: "Akun ini tidak terhubung ke GTK." }, { status: 403 });
            }
            branchId = null;
            schoolNpsn = null;
        }


        if (body.role === "ADMIN_TALENTA") {
            // sistem lama: butuh talentFields
            // fallback: izinkan jika user.role ADMIN_TALENTA
            if (talentFields.length === 0 && user.role !== "ADMIN_TALENTA") {
                return NextResponse.json({ error: "Tidak memiliki bidang Admin Talenta." }, { status: 403 });
            }
            branchId = null;
            schoolNpsn = null;
        }


        if (body.role === "ADMIN_SEKOLAH") {
            const accessId = (body as any).accessId as string | undefined;
            if (!accessId) {
                return NextResponse.json({ error: "accessId wajib diisi." }, { status: 400 });
            }


            if (accessId === "__FROM_USER__") {
                // fallback: pakai scope dari tabel user
                if (!user.branchId && !user.schoolNpsn) {
                    return NextResponse.json({ error: "Scope akses tidak valid." }, { status: 400 });
                }
                branchId = user.branchId ?? null;
                schoolNpsn = user.schoolNpsn ?? null;
            } else {
                const access = await prisma.userAccess.findFirst({
                    where: { id: accessId, userId: user.id, role: "ADMIN_SEKOLAH" },
                    select: { id: true, branchId: true, schoolNpsn: true },
                });


                if (!access) {
                    // fallback: kalau role di user ADMIN_SEKOLAH, pakai scope user
                    if (user.role !== "ADMIN_SEKOLAH" || (!user.branchId && !user.schoolNpsn)) {
                        return NextResponse.json({ error: "Akses Admin Sekolah tidak valid." }, { status: 403 });
                    }
                    branchId = user.branchId ?? null;
                    schoolNpsn = user.schoolNpsn ?? null;
                } else {
                    if (!access.branchId && !access.schoolNpsn) {
                        return NextResponse.json({ error: "Scope akses tidak valid." }, { status: 400 });
                    }
                    branchId = access.branchId ?? null;
                    schoolNpsn = access.schoolNpsn ?? null;
                }
            }
        }


        // ✅ hanya masukkan talentFields ke token kalau role ADMIN_TALENTA
        const tokenTalentFields = body.role === "ADMIN_TALENTA" ? talentFields : [];


        const token = jwt.sign(
            {
                sub: user.id,
                role: finalRole,
                branchId,
                schoolNpsn,
                gtkNik,
                talentFields: tokenTalentFields,
            },
            secret,
            {
                algorithm: "HS256",
                expiresIn: "7d",
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE,
            }
        );


        const res = NextResponse.json({ ok: true });


        const secure = process.env.COOKIE_SECURE === "true" && process.env.NODE_ENV === "production";


        res.cookies.set({
            name: COOKIE_SESSION,
            value: token,
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });


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
        console.error("POST /api/auth/select-mode error:", e);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}