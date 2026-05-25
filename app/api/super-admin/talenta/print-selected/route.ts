// app/api/super-admin/talenta/print-selected/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { ScoreEntryType, UserRole } from "@prisma/client";
import type { TalentaSuperAdmin } from "@/lib/types/talenta-super-admin";

type Body = { ids?: string[] };

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    // 1) Auth: SUPER_ADMIN
    if (!session || session.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Ambil branchId dari UserAccess
    const userId = session.sub;
    const superAccess = await prisma.userAccess.findFirst({
      where: { userId, role: UserRole.SUPER_ADMIN },
      orderBy: { createdAt: "desc" },
      select: { branchId: true },
    });

    const branchId = superAccess?.branchId ?? null;
    if (!branchId) {
      return NextResponse.json(
        { error: "SUPER_ADMIN belum terikat ke cabang (branchId null di UserAccess)." },
        { status: 400 }
      );
    }

    // 3) Parse body JSON
    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Body tidak valid (bukan JSON)." }, { status: 400 });
    }

    const ids = Array.isArray(body?.ids) ? body.ids.filter((x) => typeof x === "string") : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Daftar id tidak boleh kosong." }, { status: 400 });
    }

    // 4) Ambil data Talenta sesuai cabang SUPER_ADMIN
    const items = await prisma.talentSubmission.findMany({
      where: {
        id: { in: ids },
        gtk: {
          school: { branchId },
        },
      },
      include: {
        gtk: { select: { nik: true, name: true, school: { select: { name: true, npsn: true } } } },
        fields: {
          include: { field: { select: { name: true } } }
        },
        categories: {
          include: { category: { select: { name: true } } }
        },
        subCategories: {
          include: { subCategory: { select: { name: true } } }
        },

        type: { select: { name: true } },
        tags: { select: { name: true } },
        scoreEntries: { select: { points: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 5) Map data sesuai format print-selected
    const data: TalentaSuperAdmin[] = items.map((s) => {
      const skorSekolah = (s.scoreEntries ?? [])
        .filter((e) => e.type === ScoreEntryType.APPROVAL_SCORE)
        .reduce((sum, e) => sum + e.points, 0);

      const skorTalenta = (s.scoreEntries ?? [])
        .filter((e) => e.type === ScoreEntryType.ADJUSTMENT)
        .reduce((sum, e) => sum + e.points, 0);

      const totalSkor = skorSekolah + skorTalenta;
      const hasTalentaScore = (s.scoreEntries ?? []).some((e) => e.type === ScoreEntryType.ADJUSTMENT);
      const statusTalenta: TalentaSuperAdmin["status"] = hasTalentaScore ? "APPROVED" : "PENDING";

      const tagNames: string[] = [
        ...(Array.isArray(s.tags) ? s.tags.map((t) => t.name).filter(Boolean) : []),
        ...(Array.isArray((s as any).tagsOtherText) ? (s as any).tagsOtherText : []),
      ];

      return {
        id: s.id,
        gtk: {
          id: s.gtkNik,
          nama: s.gtk?.name ?? "-",
          sekolah: s.gtk?.school?.name ?? "-",
          npsn: s.gtk?.school?.npsn ?? "-",
          nik: s.gtk?.nik ?? "-",
        } as any,
        status: statusTalenta,
        skorTalenta: totalSkor,
        jenis: s.type?.name ?? "-",
        detailTalenta: [
          {
            id: s.id,
            namaKegiatan: s.activityName,
            penyelenggara: s.organizer ?? "",
            bidang: s.fields?.[0]?.field?.name ?? s.fieldOtherText?.[0] ?? "",
            kategori: s.categories?.[0]?.category?.name ?? s.categoryOtherText?.[0] ?? "",
            subKategori: s.subCategories?.[0]?.subCategory?.name ?? s.subCategoryOtherText?.[0] ?? undefined,
            tag: tagNames.length ? tagNames : undefined,
            deskripsi: s.description ?? "",
            tanggalMulai: "",
            durasiHari: 0,
            linkPendukung: s.linkPendukung ?? undefined,
            buktiUrl: undefined,
            skorOtomatis: skorSekolah,
            skorAdmin: skorTalenta || undefined,
            status: statusTalenta,
          } as any,
        ],
      } as any;
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error("POST /api/super-admin/talenta/print-selected error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
