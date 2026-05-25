// app/super-admin/master-talenta/page.tsx
import { prisma } from "@/app/_lib/prisma";
import DashboardLayout from "@/components/dashboard-layout";
import MasterTalentaPageSuperAdmin from "@/components/data_super_admin/master-talenta";
import { getSession } from "@/app/_lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export interface TalentTypeDto {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    typeFields: number;
    typeCategories: number;
    typeSubCategories: number;
    scopedTags: number;
    submissions: number;
  };
}

export interface TalentFieldDto {
  id: string;
  name: string;
  isActive: boolean;
  _count: {
    categories: number;
    subCategories: number;
    tags: number;
    submissions: number;
  };
}

type FieldsByType = Record<string, TalentFieldDto[]>;

export default async function SuperAdminMasterTalentaPage() {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login?next=%2Fsuper-admin%2Fdashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { name: true },
  });

  const userName = user?.name?.trim() ?? "Super Admin";

  const talentTypesRaw = await prisma.talentType.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          submissions: true,
          typeFields: true,
          typeCategories: true,
          typeSubCategories: true,
          scopedTags: true,
        },
      },
      typeFields: {
        where: { isActive: true },
        include: {
          field: {
            include: {
              _count: {
                select: { categories: true },
              },
            },
          },
        },
      },
    },
  });

  const talentTypes: TalentTypeDto[] = talentTypesRaw.map((type) => ({
    id: type.id,
    name: type.name,
    isActive: type.isActive,
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
    _count: type._count,
  }));

  const fieldsByType: FieldsByType = {};

  talentTypesRaw.forEach((type) => {
    fieldsByType[type.id] = type.typeFields.map(({ field }) => ({
      id: field.id,
      name: field.name,
      isActive: field.isActive,
      _count: {
        categories: field._count.categories ?? 0,
        subCategories: 0,
        tags: 0,
        submissions: 0,
      },
    }));
  });

  return (
    <DashboardLayout
      role="super admin"
      userName={userName}
      userPhotoUrl={null}
    >
      <MasterTalentaPageSuperAdmin
        fieldsByType={fieldsByType}
        talentTypes={talentTypes}
        typesMap={{}}
        role="super admin"
        userName={userName}
      />
    </DashboardLayout>
  );
}
