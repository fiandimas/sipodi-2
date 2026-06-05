import TalentaUserPage from "@/components/data_super_admin/talenta-user";
import { getSession } from "@/app/_lib/session";
import { prisma } from "@/app/_lib/prisma";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/auth/login?next=%2Fsuper-admin%2Fdata-sekolah");

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { name: true },
  });

  const userName = user?.name?.trim() ? user.name : "User";
  return (
    <div>
      <TalentaUserPage role="super admin" userName={userName} />
    </div>
  );
}
