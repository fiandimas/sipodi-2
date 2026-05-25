import "dotenv/config";
import {
  PrismaClient,
  UserRole,
  SchoolLevel,
  SchoolStatus,
  PasswordAlgo,
  GtkType,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import crypto from "node:crypto";
import fs from "node:fs";
import * as xlsx from "xlsx";
import path from "node:path";
import { seedTalentaMaster } from "./seed-talenta";

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL belum diset");

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DATA_SEKOLAH_DIR = path.join(process.cwd(), "data", "DATA_SEKOLAH");
const DATA_GTK_DIR = path.join(process.cwd(), "data", "DAFTAR_GTK");
const GTK_MAPPING_PATH = path.join(DATA_GTK_DIR, "mapping.json");

type GtkMapItem = { file: string; schoolNpsn: string; note?: string };
const gtkMapping: GtkMapItem[] = JSON.parse(fs.readFileSync(GTK_MAPPING_PATH, "utf8"));

type AnyRow = Record<string, any>;

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const mapelList = ["Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "IPS", "PJOK", "Seni Budaya", "Informatika"];
function randomMapel() {
  return mapelList[randInt(0, mapelList.length - 1)];
}

function norm(s: string) {
  return (s ?? "").toString().trim().replace(/\s+/g, " ").toUpperCase();
}

function loadSheetRows(filePath: string): AnyRow[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ File tidak ditemukan: ${filePath}`);
    return [];
  }
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<AnyRow>(sheet, { defval: "" });
  console.log(`📄 ${filePath}: ${rows.length} baris terbaca`);
  if (rows[0]) console.log(`🔎 Header sample: ${Object.keys(rows[0]).slice(0, 12).join(" | ")}`);
  return rows;
}

function pick(row: AnyRow, candidates: string[]) {
  for (const k of candidates) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  return "";
}

function toNull(v: any): string | null {
  const t = String(v ?? "").trim();
  if (!t) return null;
  if (t.toLowerCase() === "null") return null;
  return t;
}

function deriveJenisGtk(jenisPtk: string, jabatanPtk: string): GtkType {
  const upper = `${jenisPtk} ${jabatanPtk}`.toUpperCase();
  if (upper.includes("KEPALA SEKOLAH")) return GtkType.KEPALA_SEKOLAH;
  if (upper.includes("GURU")) return GtkType.GURU;
  if (upper.includes("TENAGA")) return GtkType.TENDIK;
  if (upper.includes("KEPALA SEKSI")) return GtkType.KEPALA_SEKSI;
  if (upper.includes("KEPALA CABANG")) return GtkType.KEPALA_CABANG_DINAS;
  return GtkType.TENDIK;
}

function deriveMapel(jabatanPtk: string, gtkType: GtkType): string | null {
  if (gtkType !== GtkType.GURU) return null;
  const upper = (jabatanPtk || "").toUpperCase();
  if (upper.includes("MATEMATIKA")) return "Matematika";
  if (upper.includes("BAHASA INDONESIA")) return "Bahasa Indonesia";
  if (upper.includes("BAHASA INGGRIS")) return "Bahasa Inggris";
  if (upper.includes("IPA")) return "IPA";
  if (upper.includes("IPS")) return "IPS";
  if (upper.includes("PJOK")) return "PJOK";
  if (upper.includes("SENI")) return "Seni Budaya";
  if (upper.includes("INFORMATIKA") || upper.includes("TIK")) return "Informatika";
  return randomMapel();
}

function stripInvisible(s: string) {
  return (s ?? "").replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").trim();
}

function normalizeNik(s: any) {
  return stripInvisible(String(s ?? "")).replace(/\D/g, "");
}

async function upsertSuperAdminGrant(userId: string, branchId: string) {
  const exists = await prisma.userAccess.findFirst({
    where: { userId, role: UserRole.SUPER_ADMIN, branchId },
    select: { id: true },
  });

  if (!exists) {
    await prisma.userAccess.create({
      data: { userId, role: UserRole.SUPER_ADMIN, branchId, schoolNpsn: null },
    });
  }
}

async function upsertAdminSekolahGrant(userId: string, branchId: string, schoolNpsn: string) {
  const exists = await prisma.userAccess.findFirst({
    where: { userId, role: UserRole.ADMIN_SEKOLAH, branchId, schoolNpsn },
    select: { id: true },
  });

  if (!exists) {
    await prisma.userAccess.create({
      data: { userId, role: UserRole.ADMIN_SEKOLAH, branchId, schoolNpsn },
    });
  }
}

async function buildUniqueUsernameFromName(baseName: string) {
  const base = baseName.trim().replace(/\s+/g, " ");
  if (!base) return "GTK";

  let candidate = base;
  let i = 1;

  while (true) {
    const exists = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!exists) return candidate;
    i += 1;
    candidate = `${base} (${i})`;
  }
}

async function main() {
  console.log("🚀 Mulai seed database...");
  console.log("📂 CWD:", process.cwd());
  console.log("📂 DATA_SEKOLAH_DIR:", DATA_SEKOLAH_DIR);

  const BRANCH_ID = "cabdin-malang";
  const BRANCH_NAME = "Cabang Dinas Wilayah Malang";
  const BRANCH_CITY = "Kota Malang";

  const PASSWORD_SUPERADMIN = "superadmin123";
  const PASSWORD_ADMIN_TALENTA = "admintalenta123";
  const PASSWORD_ADMIN_SEKOLAH = "adminsekolah123";

  // ===== branch =====
  console.log("📌 Upsert branch & letterhead...");
  const branch = await prisma.branch.upsert({
    where: { id: BRANCH_ID },
    update: { name: BRANCH_NAME, city: BRANCH_CITY },
    create: { id: BRANCH_ID, name: BRANCH_NAME, city: BRANCH_CITY },
  });

  await prisma.branchLetterhead.upsert({
    where: { branchId: branch.id },
    update: {
      title: "CABANG DINAS PENDIDIKAN WILAYAH MALANG (KOTA MALANG - KOTA BATU)",
      address: "Jalan Anjasmoro Nomor 40, Oro-oro Dowo, Kec. Klojen, Kota Malang, Jawa Timur 65119",
      phone: "(0341) 353155",
      email: "cabdinmalangbatu@gmail.com",
      logoPath: null,
      signerRole: "Kepala Cabang Dinas Pendidikan",
      signerName: "Dr. Hj. Hastini Ratna Dewi, M.Pd",
      signerRank: "Pembina Tingkat I (IV/b)",
      signerNip: "196906302003122004",
    },
    create: {
      branchId: branch.id,
      title: "CABANG DINAS PENDIDIKAN WILAYAH MALANG (KOTA MALANG - KOTA BATU)",
      address: "Jalan Anjasmoro Nomor 40, Oro-oro Dowo, Kec. Klojen, Kota Malang, Jawa Timur 65119",
      phone: "(0341) 353155",
      email: "cabdinmalangbatu@gmail.com",
      logoPath: null,
      signerRole: "Kepala Cabang Dinas Pendidikan",
      signerName: "Dr. Hj. Hastini Ratna Dewi, M.Pd",
      signerRank: "Pembina Tingkat I (IV/b)",
      signerNip: "196906302003122004",
    },
  });

  // ===== sekolah =====
  console.log("🏫 Load & upsert sekolah...");

  type SchoolSeed = {
    npsn: string;
    name: string;
    level: SchoolLevel;
    status: SchoolStatus;
    city: string;
    headName: string | null;
    headRank: string | null;
    headNip: string | null;
    address: string;
  };

  const schoolsSeed: SchoolSeed[] = [];

  function deriveSchoolStatusFromName(name: string): SchoolStatus {
    const n = norm(name);
    if (/\bNEGERI\b/.test(n)) return SchoolStatus.NEGERI;
    if (/\bSMAN\b/.test(n)) return SchoolStatus.NEGERI;
    if (/\bSMKN\b/.test(n)) return SchoolStatus.NEGERI;
    if (/\bSLBN\b/.test(n)) return SchoolStatus.NEGERI;
    return SchoolStatus.SWASTA;
  }

  // Malang
  {
    const rowsMalang = loadSheetRows(path.join(DATA_SEKOLAH_DIR, "KOTA MALANG.xlsx"));
    for (const r of rowsMalang) {
      const npsn = pick(r, ["NPSN", "Npsn", "npsn"]);
      const name = pick(r, ["Nama Satuan Pendidikan", "NAMA SATUAN PENDIDIKAN", "Nama Sekolah", "Nama"]);
      if (!npsn || !name) continue;

      const schoolStatus = deriveSchoolStatusFromName(name);
      const address = pick(r, ["Alamat", "ALAMAT"]);
      const headName = pick(r, ["Nama Kepala Sekolah", "NAMA KEPALA SEKOLAH"]) || null;

      const nameUpper = norm(name);
      let level: SchoolLevel = SchoolLevel.SMA;
      if (nameUpper.includes("SLB")) level = SchoolLevel.SLB;
      else if (nameUpper.includes("SMK")) level = SchoolLevel.SMK;
      else if (nameUpper.includes("SMA")) level = SchoolLevel.SMA;

      schoolsSeed.push({
        npsn,
        name,
        level,
        status: schoolStatus,
        city: "Kota Malang",
        headName,
        headRank: null,
        headNip: null,
        address,
      });
    }
    console.log(`✅ Sekolah Malang aktif: ${schoolsSeed.filter((s) => s.city === "Kota Malang").length}`);
  }

  // Batu (mulai dari baris 5)
  {
    const filePath = path.join(DATA_SEKOLAH_DIR, "KOTA BATU.xlsx");
    if (fs.existsSync(filePath)) {
      const wb = xlsx.readFile(filePath);
      const sheetName = wb.SheetNames[0];
      if (sheetName) {
        const sheet = wb.Sheets[sheetName];
        const range = xlsx.utils.decode_range(sheet["!ref"] as string);
        range.s.r = 4;
        sheet["!ref"] = xlsx.utils.encode_range(range);

        const rowsBatu = xlsx.utils.sheet_to_json<AnyRow>(sheet, { defval: "" });
        console.log(`📄 (BATU) ${filePath}: ${rowsBatu.length} baris terbaca`);
        if (rowsBatu[0]) console.log(`🔎 (BATU) Header sample: ${Object.keys(rowsBatu[0]).slice(0, 12).join(" | ")}`);

        for (const r of rowsBatu) {
          const npsn = pick(r, ["NPSN", "Npsn", "npsn"]);
          const name = pick(r, ["Nama Satuan Pendidikan", "NAMA SATUAN PENDIDIKAN", "Nama Sekolah", "Nama"]);
          if (!npsn || !name) continue;

          const schoolStatus = deriveSchoolStatusFromName(name);
          const address = pick(r, ["Alamat", "ALAMAT"]);
          const headName = pick(r, ["Nama Kepala Sekolah", "NAMA KEPALA SEKOLAH"]) || null;

          const nameUpper = norm(name);
          let level: SchoolLevel = SchoolLevel.SMA;
          if (nameUpper.includes("SLB")) level = SchoolLevel.SLB;
          else if (nameUpper.includes("SMK")) level = SchoolLevel.SMK;
          else if (nameUpper.includes("SMA")) level = SchoolLevel.SMA;

          schoolsSeed.push({
            npsn,
            name,
            level,
            status: schoolStatus,
            city: "Kota Batu",
            headName,
            headRank: null,
            headNip: null,
            address,
          });
        }
      }
    } else {
      console.warn(`⚠️ File tidak ditemukan: ${filePath}`);
    }

    console.log(`✅ Sekolah Batu aktif: ${schoolsSeed.filter((s) => s.city === "Kota Batu").length}`);
  }

  for (const s of schoolsSeed) {
    await prisma.school.upsert({
      where: { npsn: s.npsn },
      update: {
        name: s.name,
        level: s.level,
        status: s.status,
        city: s.city,
        headName: s.headName || undefined,
        headRank: s.headRank || undefined,
        headNip: s.headNip || undefined,
        branchId: branch.id,
      },
      create: {
        npsn: s.npsn,
        name: s.name,
        level: s.level,
        status: s.status,
        city: s.city,
        headName: s.headName || undefined,
        headRank: s.headRank || undefined,
        headNip: s.headNip || undefined,
        branchId: branch.id,
      },
    });

    await prisma.schoolLetterhead.upsert({
      where: { schoolNpsn: s.npsn },
      update: {
        title: s.name.toUpperCase(),
        address: s.address,
        phone: "0000-0000",
        logoPath: null,
      },
      create: {
        schoolNpsn: s.npsn,
        title: s.name.toUpperCase(),
        address: s.address,
        phone: "0000-0000",
        logoPath: null,
      },
    });
  }
  console.log(`✅ Total sekolah di-UPSERT: ${schoolsSeed.length}`);

  // ===== users admin =====
  console.log("👤 Upsert superadmin...");
  const superadmin = await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {
      name: "Super Admin",
      role: UserRole.SUPER_ADMIN,
      branchId: branch.id,
      schoolNpsn: null,
      gtkNik: null,
      isActive: true,
      password: sha256(PASSWORD_SUPERADMIN),
      passwordAlgo: PasswordAlgo.SHA256,
    },
    create: {
      username: "superadmin",
      name: "Super Admin",
      role: UserRole.SUPER_ADMIN,
      branchId: branch.id,
      schoolNpsn: null,
      gtkNik: null,
      isActive: true,
      password: sha256(PASSWORD_SUPERADMIN),
      passwordAlgo: PasswordAlgo.SHA256,
    },
    select: { id: true },
  });
  await upsertSuperAdminGrant(superadmin.id, branch.id);
  console.log("✅ Superadmin siap + grant");

  // ===== TALENTA MASTER (tanpa submissions) =====
  console.log("📚 Seed master talenta...");
  await seedTalentaMaster(prisma);

  const fieldsAll = await prisma.talentField.findMany({ select: { id: true, name: true } });
  if (!fieldsAll.length) throw new Error("Tidak ada TalentField setelah seedTalentaMaster.");
  console.log(`✅ TalentField: ${fieldsAll.length}`);

  console.log("👤 Upsert admin talenta per bidang...");
  for (const [idx, f] of fieldsAll.entries()) {
    const slug =
      f.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || `field_${idx + 1}`;
    const username = `admintalenta_${slug}`;

    const admin = await prisma.user.upsert({
      where: { username },
      update: {
        name: `Admin Talenta - ${f.name}`,
        role: UserRole.ADMIN_TALENTA,
        branchId: branch.id,
        schoolNpsn: null,
        gtkNik: null,
        isActive: true,
        password: sha256(PASSWORD_ADMIN_TALENTA),
        passwordAlgo: PasswordAlgo.SHA256,
      },
      create: {
        username,
        name: `Admin Talenta - ${f.name}`,
        role: UserRole.ADMIN_TALENTA,
        branchId: branch.id,
        schoolNpsn: null,
        gtkNik: null,
        isActive: true,
        password: sha256(PASSWORD_ADMIN_TALENTA),
        passwordAlgo: PasswordAlgo.SHA256,
      },
      select: { id: true },
    });

    await prisma.userTalentField.upsert({
      where: { userId_fieldId: { userId: admin.id, fieldId: f.id } },
      update: {},
      create: { userId: admin.id, fieldId: f.id },
    });
  }
  console.log("✅ Admin talenta per bidang selesai");

  console.log("👤 Upsert admin sekolah per sekolah + grant user_access...");
  for (const s of schoolsSeed) {
    const uname = `adminsekolah_${s.npsn}`;

    const adminSekolah = await prisma.user.upsert({
      where: { username: uname },
      update: {
        name: `Admin Sekolah - ${s.name}`,
        role: UserRole.ADMIN_SEKOLAH,
        branchId: branch.id,
        schoolNpsn: s.npsn,
        gtkNik: null,
        isActive: true,
        password: sha256(PASSWORD_ADMIN_SEKOLAH),
        passwordAlgo: PasswordAlgo.SHA256,
      },
      create: {
        username: uname,
        name: `Admin Sekolah - ${s.name}`,
        role: UserRole.ADMIN_SEKOLAH,
        branchId: branch.id,
        schoolNpsn: s.npsn,
        gtkNik: null,
        isActive: true,
        password: sha256(PASSWORD_ADMIN_SEKOLAH),
        passwordAlgo: PasswordAlgo.SHA256,
      },
      select: { id: true },
    });

    await upsertAdminSekolahGrant(adminSekolah.id, branch.id, s.npsn);
  }
  console.log("✅ Admin sekolah selesai + grant");

  console.log("👤 Upsert admin talenta semua bidang...");
  const multiAdminUsername = "admintalenta_all";
  const multiAdmin = await prisma.user.upsert({
    where: { username: multiAdminUsername },
    update: {
      name: "Admin Talenta Semua Bidang",
      role: UserRole.ADMIN_TALENTA,
      branchId: branch.id,
      schoolNpsn: null,
      gtkNik: null,
      isActive: true,
      password: sha256(PASSWORD_ADMIN_TALENTA),
      passwordAlgo: PasswordAlgo.SHA256,
    },
    create: {
      username: multiAdminUsername,
      name: "Admin Talenta Semua Bidang",
      role: UserRole.ADMIN_TALENTA,
      branchId: branch.id,
      schoolNpsn: null,
      gtkNik: null,
      isActive: true,
      password: sha256(PASSWORD_ADMIN_TALENTA),
      passwordAlgo: PasswordAlgo.SHA256,
    },
    select: { id: true },
  });

  for (const f of fieldsAll) {
    await prisma.userTalentField.upsert({
      where: { userId_fieldId: { userId: multiAdmin.id, fieldId: f.id } },
      update: {},
      create: { userId: multiAdmin.id, fieldId: f.id },
    });
  }
  console.log("✅ Admin talenta semua bidang selesai");

  // ===== GTK =====
  console.log("👥 (Dev) Bersihkan GTK & user GTK lama...");
  await prisma.user.deleteMany({ where: { role: UserRole.USER_GTK } });
  await prisma.gtk.deleteMany({});
  console.log("✅ Data GTK lama dibersihkan");

  type GtkSeed = {
    nik: string;
    name: string;
    email: string;
    schoolNpsn: string;
    type: GtkType;
    mapel?: string | null;
    nuptk?: string | null;
    nip?: string | null;
    gender?: "L" | "P" | null;
    birthDate?: Date | null;
  };

  const allGtk: GtkSeed[] = [];

  console.log(`👥 Load GTK dari mapping.json: ${gtkMapping.length} file`);
  for (const item of gtkMapping) {
    if (!item.schoolNpsn) {
      console.warn(`⚠️ mapping kosong (schoolNpsn): ${item.file}`);
      continue;
    }

    const filePath = path.join(process.cwd(), item.file);
    const gtkRows = loadSheetRows(filePath);
    if (!gtkRows.length) continue;

    const schoolNpsn = item.schoolNpsn;

    const schoolExists = await prisma.school.findUnique({
      where: { npsn: schoolNpsn },
      select: { npsn: true },
    });
    if (!schoolExists) {
      console.warn(`⚠️ NPSN tidak ada di tabel School: ${schoolNpsn} (file ${item.file})`);
      continue;
    }

    for (const r of gtkRows) {
      const name = pick(r, ["Nama Lengkap", "NAMA LENGKAP", "Nama", "NAMA"]);
      if (!name) continue;

      // WAJIB: pakai NIK asli dari Excel
      const nikRaw = pick(r, ["NIK", "Nik"]);
      const nik = normalizeNik(nikRaw);

      if (nik.length !== 16) {
        console.warn("⚠️ Skip GTK: NIK invalid", { nikRaw, nik, name, schoolNpsn, file: item.file });
        continue;
      }

      const nuptk = toNull(stripInvisible(pick(r, ["NUPTK", "Nuptk"])));
      const nip = toNull(stripInvisible(pick(r, ["NIP", "Nip"])));

      const genderRaw = toNull(stripInvisible(pick(r, ["L/P", "L_P", "JK", "Jenis Kelamin"])));
      const gender = genderRaw === "L" || genderRaw === "P" ? (genderRaw as "L" | "P") : null;

      const birthDateStr = toNull(stripInvisible(pick(r, ["Tanggal Lahir", "TANGGAL LAHIR", "Tgl Lahir"])));
      let birthDate: Date | null = null;
      if (birthDateStr) {
        const d = new Date(birthDateStr);
        if (!isNaN(d.getTime())) birthDate = d;
      }

      const jenisPtk = pick(r, ["Jenis PTK", "JENIS PTK", "Jenis"]);
      const jabatanPtk = pick(r, ["Jabatan PTK", "JABATAN PTK", "Jabatan"]);
      const type = deriveJenisGtk(jenisPtk, jabatanPtk);
      const mapel = deriveMapel(jabatanPtk, type);

      const safeName =
        (name || "gtk")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ".")
          .replace(/^\.+|\.+$/g, "") || "gtk";
      const email = `${safeName}.${nik}@${schoolNpsn}.example.com`.toLowerCase();

      allGtk.push({
        nik,
        name,
        email,
        schoolNpsn,
        type,
        mapel,
        nuptk,
        nip,
        gender,
        birthDate,
      });
    }
  }

  const byNik = new Map<string, GtkSeed>();
  for (const g of allGtk) if (!byNik.has(g.nik)) byNik.set(g.nik, g);
  const gtkFinal = [...byNik.values()];
  console.log(`✅ GTK final setelah dedup nik: ${gtkFinal.length}`);

  console.log("💾 Upsert GTK + user GTK (username=NIK, password=NIK)...");
  for (const g of gtkFinal) {
    const gtk = await prisma.gtk.upsert({
      where: { nik: g.nik },
      update: {
        name: g.name,
        email: g.email,
        schoolNpsn: g.schoolNpsn,
        mapel: g.mapel ?? undefined,
        type: g.type,
        nuptk: g.nuptk ?? undefined,
        nip: g.nip ?? undefined,
        gender: g.gender ?? undefined,
        birthDate: g.birthDate ?? undefined,
      },
      create: {
        nik: g.nik,
        name: g.name,
        email: g.email,
        schoolNpsn: g.schoolNpsn,
        mapel: g.mapel ?? undefined,
        type: g.type,
        nuptk: g.nuptk ?? undefined,
        nip: g.nip ?? undefined,
        gender: g.gender ?? undefined,
        birthDate: g.birthDate ?? undefined,
      },
      select: { nik: true, name: true, schoolNpsn: true },
    });

    const username = await buildUniqueUsernameFromName(gtk.name);

    await prisma.user.upsert({
      where: { gtkNik: gtk.nik },
      update: {
        username,
        name: gtk.name,
        role: UserRole.USER_GTK,
        isActive: true,
        schoolNpsn: gtk.schoolNpsn,
        branchId: branch.id,
        password: sha256(gtk.nik),
        passwordAlgo: PasswordAlgo.SHA256,
      },
      create: {
        username,
        name: gtk.name,
        role: UserRole.USER_GTK,
        isActive: true,
        gtkNik: gtk.nik,
        schoolNpsn: gtk.schoolNpsn,
        branchId: branch.id,
        password: sha256(gtk.nik),
        passwordAlgo: PasswordAlgo.SHA256,
      },
    });
  }
  console.log(`✅ Total GTK di-UPSERT: ${gtkFinal.length}`);

  // ===== Sinkronisasi UserAccess =====
  console.log("🔐 Sinkronisasi default UserAccess untuk semua role...");

  // SUPER_ADMIN
  {
    const superAdmins = await prisma.user.findMany({
      where: { role: UserRole.SUPER_ADMIN },
      select: { id: true },
    });

    for (const u of superAdmins) {
      const exists = await prisma.userAccess.findFirst({
        where: { userId: u.id, role: UserRole.SUPER_ADMIN, branchId: branch.id },
        select: { id: true },
      });

      if (!exists) {
        await prisma.userAccess.create({
          data: { userId: u.id, role: UserRole.SUPER_ADMIN, branchId: branch.id, schoolNpsn: null },
        });
      }
    }
  }

  // ADMIN_TALENTA
  {
    const adminsTalenta = await prisma.user.findMany({
      where: { role: UserRole.ADMIN_TALENTA },
      select: { id: true },
    });

    for (const u of adminsTalenta) {
      const exists = await prisma.userAccess.findFirst({
        where: { userId: u.id, role: UserRole.ADMIN_TALENTA, branchId: branch.id },
        select: { id: true },
      });

      if (!exists) {
        await prisma.userAccess.create({
          data: { userId: u.id, role: UserRole.ADMIN_TALENTA, branchId: branch.id, schoolNpsn: null },
        });
      }
    }
  }

  // ADMIN_SEKOLAH
  {
    const adminsSekolah = await prisma.user.findMany({
      where: { role: UserRole.ADMIN_SEKOLAH, schoolNpsn: { not: null } },
      select: { id: true, schoolNpsn: true },
    });

    for (const u of adminsSekolah) {
      if (!u.schoolNpsn) continue;

      const exists = await prisma.userAccess.findFirst({
        where: {
          userId: u.id,
          role: UserRole.ADMIN_SEKOLAH,
          branchId: branch.id,
          schoolNpsn: u.schoolNpsn,
        },
        select: { id: true },
      });

      if (!exists) {
        await prisma.userAccess.create({
          data: { userId: u.id, role: UserRole.ADMIN_SEKOLAH, branchId: branch.id, schoolNpsn: u.schoolNpsn },
        });
      }
    }
  }

  // USER_GTK
  {
    const gtkUsers = await prisma.user.findMany({
      where: { role: UserRole.USER_GTK, schoolNpsn: { not: null } },
      select: { id: true, schoolNpsn: true },
    });

    for (const u of gtkUsers) {
      if (!u.schoolNpsn) continue;

      const exists = await prisma.userAccess.findFirst({
        where: {
          userId: u.id,
          role: UserRole.USER_GTK,
          branchId: branch.id,
          schoolNpsn: u.schoolNpsn,
        },
        select: { id: true },
      });

      if (!exists) {
        await prisma.userAccess.create({
          data: { userId: u.id, role: UserRole.USER_GTK, branchId: branch.id, schoolNpsn: u.schoolNpsn },
        });
      }
    }
  }

  console.log("✅ Sinkronisasi UserAccess selesai");
  console.log("🎉 Seed selesai.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("🔌 Prisma disconnected");
  });
