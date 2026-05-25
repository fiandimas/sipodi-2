import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { z } from "zod";
import { GtkType } from "@prisma/client";

const paramsSchema = z.object({
  npsn: z.string().min(1),
});

const updateSchoolSchema = z.object({
  name: z.string().min(2).optional(),
  level: z.enum(["SMA", "SMK", "SLB"]).optional(),
  status: z.enum(["NEGERI", "SWASTA"]).optional(),
  city: z.string().min(2).optional(),

  // sengaja TIDAK menerima headName/headNip/headRank di edit
  // (konsisten dengan modal edit Anda: headName dikontrol GTK)
});

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function ensureSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return { ok: false as const, error: jsonError(401, "Unauthorized") };
  }
  return { ok: true as const };
}

function normOptionalString(x: unknown): string | undefined {
  if (typeof x !== "string") return undefined;
  const t = x.trim();
  return t ? t : undefined;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ npsn: string }> }) {
  const auth = await ensureSuperAdmin();
  if (!auth.ok) return auth.error;

  const params = await ctx.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return jsonError(400, "Invalid npsn");

  const { npsn } = parsed.data;

  const school = await prisma.school.findUnique({
    where: { npsn },
    select: {
      npsn: true,
      name: true,
      level: true,
      status: true,
      city: true,
      headName: true,
      headNip: true,
      headRank: true,
      branchId: true,
      createdAt: true,
      updatedAt: true,
      gtks: {
        where: { type: GtkType.KEPALA_SEKOLAH },
        select: { name: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!school) return jsonError(404, "School not found");

  const kepalaNames = school.gtks
    .map((g) => g.name)
    .filter((n): n is string => !!n && n.trim().length > 0);

  const headName = kepalaNames.length > 0 ? kepalaNames.join(", ") : school.headName ?? null;

  return NextResponse.json({
    npsn: school.npsn,
    name: school.name,
    level: school.level,
    status: school.status,
    city: school.city,
    headName,
    headNip: school.headNip,
    headRank: school.headRank,
    branchId: school.branchId,
    createdAt: school.createdAt,
    updatedAt: school.updatedAt,
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ npsn: string }> }) {
  const auth = await ensureSuperAdmin();
  if (!auth.ok) return auth.error;

  const params = await ctx.params;
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) return jsonError(400, "Invalid npsn");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Body must be valid JSON");
  }

  const parsedBody = updateSchoolSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(400, parsedBody.error.issues[0]?.message ?? "Invalid body");
  }

  const { npsn } = parsedParams.data;
  const input = parsedBody.data;

  const exist = await prisma.school.findUnique({
    where: { npsn },
    select: { npsn: true },
  });
  if (!exist) return jsonError(404, "School not found");

  // ✅ trim + undefined supaya Prisma "skip update" jika kosong/tidak ada
  const name = normOptionalString(input.name);
  const city = normOptionalString(input.city);

  try {
    const updated = await prisma.school.update({
      where: { npsn },
      data: {
        name: name ?? undefined,
        level: input.level ?? undefined,
        status: input.status ?? undefined,
        city: city ?? undefined,
      },
      select: {
        npsn: true,
        name: true,
        level: true,
        status: true,
        city: true,
        headName: true,
        headNip: true,
        headRank: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
        gtks: {
          where: { type: GtkType.KEPALA_SEKOLAH },
          select: { name: true },
          orderBy: { name: "asc" },
        },
      },
    });

    const kepalaNames = updated.gtks
      .map((g) => g.name)
      .filter((n): n is string => !!n && n.trim().length > 0);

    const headNameOut = kepalaNames.length > 0 ? kepalaNames.join(", ") : updated.headName ?? null;

    return NextResponse.json({
      npsn: updated.npsn,
      name: updated.name,
      level: updated.level,
      status: updated.status,
      city: updated.city,
      headName: headNameOut,
      headNip: updated.headNip,
      headRank: updated.headRank,
      branchId: updated.branchId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    console.error("PUT /api/super-admin/school-management/[npsn] error:", e);
    return jsonError(500, "Internal error");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ npsn: string }> }) {
  const auth = await ensureSuperAdmin();
  if (!auth.ok) return auth.error;

  const params = await ctx.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return jsonError(400, "Invalid npsn");

  const { npsn } = parsed.data;

  const exist = await prisma.school.findUnique({
    where: { npsn },
    select: { npsn: true },
  });
  if (!exist) return jsonError(404, "School not found");

  try {
    await prisma.school.delete({ where: { npsn } });
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error("DELETE /api/super-admin/school-management/[npsn] error:", e);
    return jsonError(500, "Internal error");
  }
}
