// app/admin-talenta/master-talenta/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/app/_lib/session";
import { prisma } from "@/app/_lib/prisma";

import MasterTalentaPage from "@/components/data_admin_talenta/master-talenta";

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

export default async function Page() {
  const session = await getSession();

  if (!session || session.role !== "ADMIN_TALENTA") {
    redirect("/auth/login?next=%2Fadmin-talenta%2Fmaster-talenta");
  }

  const userId = session.sub;

  const userFields = await prisma.userTalentField.findMany({
    where: { userId },
    include: {
      field: {
        include: {
          typeFields: {
            include: {
              type: {
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
                },
              },
            },
          },
          categories: {
            where: { isActive: true },
            include: {
              subCategories: {
                where: { isActive: true },
                include: {
                  scopedTags: true,
                  submissionSubCategories: true,
                },
              },
              submissionCategories: true,
            },
          },
          submissionFields: true,
        },
      },
    },
  });

  const allAccessibleFields: TalentFieldDto[] = userFields.map((UF) => ({
    id: UF.field.id,
    name: UF.field.name,
    isActive: UF.field.isActive,
    _count: {
      categories: UF.field.categories.length,
      subCategories: UF.field.categories.reduce(
        (sum, c) => sum + c.subCategories.length,
        0
      ),
      tags: UF.field.categories.reduce(
        (sum, c) =>
          sum +
          c.subCategories.reduce((s2, sc) => s2 + sc.scopedTags.length, 0),
        0
      ),
      submissions: UF.field.submissionFields.length,
    },
  }));

  const talentTypesMap: Record<string, TalentTypeDto> = {};
  const fieldsByType: FieldsByType = {};

  for (const UF of userFields) {
    for (const TF of UF.field.typeFields) {
      const type = TF.type;

      if (!talentTypesMap[type.id]) {
        talentTypesMap[type.id] = {
          id: type.id,
          name: type.name,
          isActive: type.isActive,
          createdAt: type.createdAt.toISOString(),
          updatedAt: type.updatedAt.toISOString(),
          _count: type._count,
        };
      }

      const field = UF.field;
      const categories = field.categories;

      const categoryCount = categories.length;
      const subCategoryCount = categories.reduce(
        (sum, c) => sum + c.subCategories.length,
        0
      );

      const tagCount = categories.reduce(
        (tagSum, c) =>
          tagSum +
          c.subCategories.reduce(
            (scSum, sc) => scSum + sc.scopedTags.length,
            0
          ),
        0
      );

      const submissionCount = field.submissionFields.length;

      const fieldDto: TalentFieldDto = {
        id: field.id,
        name: field.name,
        isActive: field.isActive,
        _count: {
          categories: categoryCount,
          subCategories: subCategoryCount,
          tags: tagCount,
          submissions: submissionCount,
        },
      };

      if (!fieldsByType[type.id]) fieldsByType[type.id] = [];
      fieldsByType[type.id].push(fieldDto);
    }
  }

  const talentTypes = Object.values(talentTypesMap);

  return (
    <MasterTalentaPage fields={allAccessibleFields} />
  );
}
