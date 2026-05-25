import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL belum diset");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

async function run(k) {
  const rows = await prisma.school.findMany({
    where: {
      city: { contains: "Malang", mode: "insensitive" },
      name: { contains: k, mode: "insensitive" },
    },
    select: { npsn: true, name: true },
  });

  console.log(`\n== ${k} ==`);
  console.log(rows);
}

async function main() {
  await run("INDOTEKNIKA");
  await run("PRAJNAPARAMITA");
  await run("SRIWEDARI");
  await run("WISNU");
  await run("NASIONAL");
  await run("PETRA");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
