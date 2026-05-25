// app/admin-talenta/data-talenta/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/app/_lib/session";

export default async function Page() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN_TALENTA") {
    redirect("/auth/login");
  }

  const first = session.talentFields[0];
  if (!first) return null;

  redirect(`/admin-talenta/data-talenta/${first.id}`);
}
