import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/app/_lib/session";
import { prisma } from "@/app/_lib/prisma";
import DashboardLayout from "@/components/dashboard-layout";
import { mapRoleToUiRole } from "@/app/_lib/role-map";

export default async function AdminTalentaLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN_TALENTA") redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { name: true}, // kalau ada
  });

  const userName = user?.name?.trim() ? user.name : "User";

  return (
    <DashboardLayout
      role={mapRoleToUiRole(session.role)}
      userName={userName}
      // userPhotoUrl={user?.photoUrl ?? null} // opsional
      talentFields={session.talentFields}
    >
      {children}
    </DashboardLayout>
  );
}
