import DashboardClient from "@/components/data_super_admin/dashboard";
import { getSession } from "@/app/_lib/session";
import { prisma } from "@/app/_lib/prisma";
import { redirect } from "next/navigation";

export default async function SuperAdminDashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login?next=%2Fsuper-admin%2Fdashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { name: true },
  });

  const userName = user?.name?.trim() ? user.name : "User";

  return <DashboardClient role="super admin" userName={userName} />;
}
