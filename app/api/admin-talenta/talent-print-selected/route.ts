// app/api/admin-talenta/talent-print-selected/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    // Validasi session & role
    if (!session || session.role !== UserRole.ADMIN_TALENTA) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ambil body
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: "ids harus array dan minimal 1" },
        { status: 400 }
      );
    }
    const ids: string[] = body.ids.map(String);

    // Ambil bidang talenta yang diotorisasi
    const allowedFieldIds = (session.talentFields || []).map((f: any) => f.id);
    if (!allowedFieldIds.length) {
      return NextResponse.json(
        { error: "Admin belum punya bidang talenta yang diotorisasi." },
        { status: 400 }
      );
    }

    const submissions = await prisma.talentSubmission.findMany({
      where: {
        id: { in: ids },
        fields: {
          some: {
            fieldId: { in: allowedFieldIds }
          }
        },
        OR: [
          { status: "APPROVED", approvedScope: null },
          { status: "APPROVED", approvedScope: "SEKOLAH" },
          { status: "APPROVED", approvedScope: { in: ["TALENTA", "SUPER_ADMIN"] } },
          { status: "REJECTED", rejectedScope: { in: ["TALENTA", "SUPER_ADMIN"] } },
        ],
      },

      include: {
        gtk: {
          select: {
            name: true,
            nik: true,
            school: { select: { name: true, npsn: true } },
          },
        },
        type: { select: { name: true } },
        fields: {
          include: { field: { select: { name: true } } }
        },
        categories: {
          include: { category: { select: { name: true } } }
        },
        subCategories: {
          include: { subCategory: { select: { name: true } } }
        },
        tags: { select: { name: true } },
      },
    });

    if (!submissions.length) {
      return NextResponse.json(
        { error: "Tidak ada data talenta yang sesuai dengan IDs atau status/field." },
        { status: 400 }
      );
    }

    // Mapping data untuk response
    const items = submissions.map((s) => {
      const tagNames: string[] = Array.isArray(s.tags)
        ? s.tags.map((t) => t.name).filter(Boolean)
        : [];

      const tagsOtherText = (s as any).tagsOtherText;
      if (Array.isArray(tagsOtherText)) tagNames.push(...tagsOtherText.filter(Boolean));

      return {
        jenisTalenta: s.type?.name ?? "",
        fieldLabel: s.fields?.[0]?.field?.name ?? "",
        activityName: s.activityName,
        description: s.description ?? "",
        subject: s.subCategories?.[0]?.subCategory?.name ?? "",
        gtk: {
          name: s.gtk?.name ?? "",
          school: {
            name: s.gtk?.school?.name ?? "",
            npsn: s.gtk?.school?.npsn ?? "",
          },
          nik: s.gtk?.nik ?? "",
        },
        tags: tagNames,
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("POST /admin-talenta/talent-print-selected error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
