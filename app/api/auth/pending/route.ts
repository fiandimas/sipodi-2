import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/app/_lib/prisma";
import { UserRole } from "@prisma/client";

const COOKIE_PENDING = "sipodi_pending_login";
const JWT_ISSUER = "sipodi";
const JWT_AUDIENCE = "sipodi-web";

type PendingPayload = { sub: string; typ?: string };

export async function GET(req: NextRequest) {
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

        let payload: PendingPayload;
        try {
            payload = jwt.verify(pending, secret, {
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

        const userId = payload?.sub;
        if (!userId) {
            return NextResponse.json({ error: "Pending login tidak valid." }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                name: true,
                isActive: true,

                // fallback fields (cara baru)
                role: true,
                branchId: true,
                schoolNpsn: true,
                gtkNik: true,

                // ADMIN_TALENTA source-of-truth lama: UserTalentField
                talentFields: {
                    select: { field: { select: { id: true, name: true, isActive: true } } },
                },

                // source-of-truth grants lama: UserAccess
                access: {
                    select: {
                        id: true,
                        role: true,
                        schoolNpsn: true,
                        branchId: true,
                        school: { select: { npsn: true, name: true, city: true } },
                        branch: { select: { id: true, name: true, city: true } },
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User tidak ditemukan." }, { status: 401 });
        }

        if (!user.isActive) {
            return NextResponse.json({ error: "Akun tidak aktif." }, { status: 403 });
        }

        // ===== hitung mode dari sistem lama =====
        const hasSuperAdminByAccess = (user.access ?? []).some((a) => a.role === "SUPER_ADMIN");

        const talentFields = (user.talentFields || [])
            .map((x) => x.field)
            .filter((f) => f.isActive)
            .map((f) => ({ id: f.id, name: f.name }));
        const hasTalentaByFields = talentFields.length > 0;

        const schoolAccessRows = (user.access ?? []).filter((a) => a.role === "ADMIN_SEKOLAH");
        const hasSchoolAdminByAccess = schoolAccessRows.length > 0;

        const hasGtkByUser = !!user.gtkNik;

        // ===== fallback dari kolom user.role =====
        const role = user.role as UserRole;

        const hasSuperAdmin = hasSuperAdminByAccess || role === "SUPER_ADMIN";
        const hasTalenta = hasTalentaByFields || role === "ADMIN_TALENTA";
        const hasSchoolAdmin = hasSchoolAdminByAccess || role === "ADMIN_SEKOLAH";
        const hasGtk = hasGtkByUser || role === "USER_GTK";

        const availableModes: any[] = [];

        if (hasSuperAdmin) availableModes.push({ role: "SUPER_ADMIN" as UserRole });

        // USER_GTK: butuh gtkNik supaya bisa dipakai select-mode (karena select-mode memvalidasi gtkNik)
        if (hasGtk && user.gtkNik) {
            availableModes.push({ role: "USER_GTK" as UserRole, gtkNik: user.gtkNik });
        }

        if (hasTalenta) {
            // jika tidak ada talentFields (karena fallback role), tetap izinkan mode,
            // tapi select-mode akan memvalidasi lebih lanjut (lihat perbaikan di bawah)
            availableModes.push({ role: "ADMIN_TALENTA" as UserRole, talentFields });
        }

        if (hasSchoolAdmin) {
            // kalau tidak ada akses rows (fallback role), buat 1 opsi dari kolom user
            const options =
                schoolAccessRows.length > 0
                    ? schoolAccessRows.map((a) => ({
                        accessId: a.id,
                        branchId: a.branchId ?? null,
                        schoolNpsn: a.schoolNpsn ?? null,
                        label: a.school
                            ? `Sekolah: ${a.school.name} (${a.school.city})`
                            : a.branch
                                ? `Cabang: ${a.branch.name} (${a.branch.city})`
                                : a.schoolNpsn
                                    ? `Sekolah: ${a.schoolNpsn}`
                                    : a.branchId
                                        ? `Cabang: ${a.branchId}`
                                        : "Scope tidak valid",
                    }))
                    : [
                        {
                            // fallback accessId (bukan id userAccess), akan ditangani di select-mode
                            accessId: "__FROM_USER__",
                            branchId: user.branchId ?? null,
                            schoolNpsn: user.schoolNpsn ?? null,
                            label:
                                user.schoolNpsn
                                    ? `Sekolah: ${user.schoolNpsn}`
                                    : user.branchId
                                        ? `Cabang: ${user.branchId}`
                                        : "Scope tidak valid",
                        },
                    ];

            // jangan push kalau benar-benar tidak ada scope
            const validOptions = options.filter((o) => o.branchId || o.schoolNpsn);
            if (validOptions.length > 0) {
                availableModes.push({
                    role: "ADMIN_SEKOLAH" as UserRole,
                    options: validOptions,
                });
            }
        }

        if (availableModes.length === 0) {
            return NextResponse.json(
                { error: "Akun tidak memiliki mode akses (GTK/Talenta/Sekolah/Super Admin)." },
                { status: 403 }
            );
        }

        return NextResponse.json({
            ok: true,
            user: { id: user.id, username: user.username, name: user.name },
            availableModes,
        });
    } catch (e) {
        console.error("GET /api/auth/pending error:", e);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
