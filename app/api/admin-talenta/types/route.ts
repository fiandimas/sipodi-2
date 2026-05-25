import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET() {
    try {
        const session = await getSession();

        if (!session || session.role !== "ADMIN_TALENTA") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminFields = await prisma.userTalentField.findMany({
            where: { userId: session.sub },
            select: { fieldId: true }
        });

        const fieldIds = adminFields.map(f => f.fieldId);

        if (fieldIds.length === 0) {
            return NextResponse.json({ types: [] });
        }

        const types = await prisma.talentType.findMany({
            where: {
                isActive: true,
                typeFields: {
                    some: { fieldId: { in: fieldIds } }
                },
            },
            orderBy: { name: "asc" },

            select: {
                id: true,
                name: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,

                _count: {
                    select: {
                        typeFields: true,
                        typeCategories: true,
                        typeSubCategories: true,
                        scopedTags: true,

                        submissions: true,
                    },
                },

                typeFields: {
                    select: {
                        fieldId: true,
                        field: { select: { name: true } }
                    }
                },
            },
        });

        return NextResponse.json({ types });

    } catch (error) {
        console.error("ADMIN TALENTA GET TYPES ERROR:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}


export async function POST(req: Request) {
    try {
        const session = await getSession();

        if (!session || session.role !== "ADMIN_TALENTA") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json().catch(() => null);

        const name = body?.name?.trim();
        const fieldId = body?.fieldId;

        if (!name) {
            return NextResponse.json(
                { error: "Nama jenis talenta wajib diisi" },
                { status: 400 }
            );
        }

        if (!fieldId) {
            return NextResponse.json(
                { error: "Bidang wajib dipilih sebelum membuat jenis talenta" },
                { status: 400 }
            );
        }

        // cek apakah admin punya akses ke field itu
        const validField = await prisma.userTalentField.findFirst({
            where: { userId: session.sub, fieldId }
        });

        if (!validField) {
            return NextResponse.json(
                { error: "Anda tidak memiliki akses ke bidang ini" },
                { status: 403 }
            );
        }

        const type = await prisma.talentType.create({
            data: {
                name,
                typeFields: {
                    create: {
                        fieldId
                    }
                }
            },
            select: {
                id: true,
                name: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        typeFields: true,
                        typeCategories: true,
                        typeSubCategories: true,
                        scopedTags: true,
                        submissions: true,
                    }
                }
            }
        });

        return NextResponse.json({ type }, { status: 201 });

    } catch (e: any) {
        if (e.code === "P2002") {
            return NextResponse.json(
                { error: "Jenis talenta dengan nama ini sudah ada" },
                { status: 409 }
            );
        }

        console.error("ADMIN TALENTA POST TYPE ERROR:", e);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}