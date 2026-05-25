import GtkPage from "@/components/data_admin_sekolah/gtk";
import { getSession } from "@/app/_lib/session";
import { prisma } from "@/app/_lib/prisma";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login?next=%2Fsuper-admin%2Fdashboard");
  }

  if (session.role !== "ADMIN_SEKOLAH") {
    redirect("/unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { name: true, schoolNpsn: true },
  });

  if (!user || !user.schoolNpsn) {
    redirect("/unauthorized");
  }

  const userName = user?.name?.trim() ? user.name : "User";
  const schoolNpsn = user?.schoolNpsn;  // Mendapatkan NPSN sekolah admin

  return <GtkPage role="admin sekolah" userName={userName} schoolNpsn={schoolNpsn} />;
}
