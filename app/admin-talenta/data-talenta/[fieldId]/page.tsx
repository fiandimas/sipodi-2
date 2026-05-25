// app/admin-talenta/data-talenta/[fieldId]/page.tsx
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/app/_lib/session";
import DataTalentaPage from "@/components/data_admin_talenta/talenta";

type PageProps = {
  params: Promise<{ fieldId: string }>;
  searchParams?: Promise<{ page?: string }>;
};

export default async function DataTalentaFieldPage(props: PageProps) {
  const session = await getSession();

  if (!session || session.role !== "ADMIN_TALENTA") {
    redirect("/auth/login");
  }

  const { fieldId } = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const page = Number(searchParams.page ?? "1") || 1;

  const allowed = session.talentFields.some((f) => f.id === fieldId);
  if (!allowed) {
    notFound();
  }

  return (
    <DataTalentaPage
      role={session.role}
      fieldId={fieldId}
      initialPage={page}
    />
  );
}
