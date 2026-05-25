"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import JenisTalentaSection from "./master-talenta/jenis-talenta-section";
import BidangSection from "./master-talenta/bidang-section";
import KategoriSection from "./master-talenta/kategori-section";
import SubKategoriSection from "./master-talenta/subkategori-section";
import TagSection from "./master-talenta/tag-section";

// ======================
// TYPE DEFINITIONS
// ======================
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

export interface CategoryDto {
  id: string;
  name: string;
  isActive: boolean;
  fieldId: string;
  _count: {
    categories: number;
    subCategories: number;
    tags: number;
    submissions: number;
  };
}

export interface SubCategoryDto {
  id: string;
  name: string;
  isActive: boolean;
  categoryId: string;
  _count?: { tags: number; submissions: number };
}

export interface TagDto {
  id: string;
  name: string;
  isActive: boolean;
  _count: { submissions: number };
}

// ======================
// PROPS
// ======================
type Props = {
  fieldsByType: Record<string, TalentFieldDto[]>;
  talentTypes: TalentTypeDto[];
  typesMap: Record<string, any>;
  role: string;
  userName: string;
};

export default function MasterTalentaPageSuperAdmin({
  fieldsByType,
  talentTypes,
  typesMap,
  role,
  userName,
}: Props) {
  const [hierarchy, setHierarchy] = useState({
    types: talentTypes as TalentTypeDto[],
    fields: fieldsByType,
    categories: {} as Record<string, CategoryDto[]>,
    subCategories: {} as Record<string, SubCategoryDto[]>,
    tags: {} as Record<string, TagDto[]>,
  });

  const [activeTypeId, setActiveTypeId] = useState<string>("");
  const [activeFieldId, setActiveFieldId] = useState<string>("");
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [activeSubCategoryId, setActiveSubCategoryId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("jenis-talenta");
  const [userSelectedField, setUserSelectedField] = useState(false);
  const [userSelectedCategory, setUserSelectedCategory] = useState(false);

  useEffect(() => {
    if (
      activeTypeId &&
      hierarchy.fields[activeTypeId]?.length > 0 &&
      !activeFieldId
    ) {
      setActiveFieldId(hierarchy.fields[activeTypeId][0].id);
    }
  }, [hierarchy.fields, activeTypeId, activeFieldId]);

  const fetcher = useCallback(async (url: string) => {
    const res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  }, []);

  const loadTypes = useCallback(async () => {
    try {
      const data = await fetcher("/api/super-admin/types");

      setHierarchy((prev) => ({
        ...prev,
        types: data.types || [],
      }));

      setActiveTypeId((prev) =>
        data.types.some((t: any) => t.id === prev) ? prev : ""
      );
    } catch (error) {
      console.error("Failed to load types:", error);
    }
  }, [fetcher]);

  useEffect(() => {
    setHierarchy((prev) => ({
      ...prev,
      types: talentTypes,
      fields: fieldsByType
    }));
  }, [talentTypes, fieldsByType]);

  const loadFields = useCallback(
    async (typeId: string) => {
      if (!typeId) return;

      try {
        const data = await fetcher(`/api/super-admin/fields/${typeId}`);

        setHierarchy((prev) => ({
          ...prev,
          fields: { ...prev.fields, [typeId]: data.fields || [] },
        }));

        setHierarchy((prev) => ({
          ...prev,
          types: prev.types.map((t) =>
            t.id === typeId
              ? { ...t, _count: { ...t._count, typeFields: data.fields.length } }
              : t
          ),
        }));
      } catch (error) {
        console.error("Failed to load fields:", error);
      }
    },
    [fetcher]
  );

  const loadCategories = useCallback(
    async (typeId: string, fieldId: string) => {
      if (!typeId || !fieldId) return;

      try {
        const data = await fetcher(
          `/api/super-admin/categories/${typeId}/${fieldId}`
        );

        setHierarchy((prev) => ({
          ...prev,
          categories: {
            ...prev.categories,
            [fieldId]: data.categories || [],
          },
        }));
      } catch (error) {
        console.error("Failed to load categories:", error);
      }
    },
    [fetcher]
  );

  const loadSubCategories = useCallback(
    async (typeId: string, categoryId: string) => {
      if (!typeId || !categoryId) return;

      try {
        const data = await fetcher(
          `/api/super-admin/sub-categories/${typeId}/${categoryId}`
        );

        setHierarchy((prev) => ({
          ...prev,
          subCategories: {
            ...prev.subCategories,
            [categoryId]: data.subCategories || [],
          },
        }));
      } catch (error) {
        console.error("Failed to load subcategories:", error);
      }
    },
    [fetcher]
  );

  const loadTags = useCallback(
    async (typeId: string, subCategoryId: string) => {
      if (!typeId || !subCategoryId) return;

      try {
        const data = await fetcher(
          `/api/super-admin/tags/${typeId}/${subCategoryId}`
        );

        setHierarchy((prev) => ({
          ...prev,
          tags: {
            ...prev.tags,
            [subCategoryId]: data.tags || [],
          },
        }));
      } catch (error) {
        console.error("Failed to load tags:", error);
      }
    },
    [fetcher]
  );

  useEffect(() => {
    if (activeTypeId) loadFields(activeTypeId);
  }, [activeTypeId, loadFields]);

  useEffect(() => {
    if (activeFieldId) loadCategories(activeTypeId, activeFieldId);
  }, [activeFieldId, activeTypeId, loadCategories]);

  useEffect(() => {
    if (activeCategoryId)
      loadSubCategories(activeTypeId, activeCategoryId);
  }, [activeCategoryId, activeTypeId, loadSubCategories]);

  useEffect(() => {
    if (activeSubCategoryId)
      loadTags(activeTypeId, activeSubCategoryId);
  }, [activeSubCategoryId, activeTypeId, loadTags]);

  useEffect(() => {
    setActiveCategoryId("");
    setActiveSubCategoryId("");
    setHierarchy((prev) => ({
      ...prev,
      subCategories: {},
      tags: {},
    }));
  }, [activeFieldId]);

  useEffect(() => {
    setActiveSubCategoryId("");
    setHierarchy((prev) => ({
      ...prev,
      tags: {},
    }));
  }, [activeCategoryId]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Master Talenta</h1>
        <p className="text-muted-foreground mt-1">
          Kelola lengkap Jenis Talenta → Bidang → Kategori → Subkategori → Tag
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="jenis-talenta">Jenis Talenta</TabsTrigger>
          <TabsTrigger value="bidang" disabled={!activeTypeId}>
            Bidang
          </TabsTrigger>
          <TabsTrigger value="kategori" disabled={!activeFieldId}>
            Kategori
          </TabsTrigger>
          <TabsTrigger value="subkategori" disabled={!userSelectedCategory}>
            Sub Kategori
          </TabsTrigger>
          <TabsTrigger value="tag" disabled={!activeSubCategoryId}>
            Tag
          </TabsTrigger>
        </TabsList>

        {/* Jenis Talenta */}
        <TabsContent value="jenis-talenta">
          <JenisTalentaSection
            types={hierarchy.types}
            activeTypeId={activeTypeId}
            onTypeChange={(id) => {
              setActiveTypeId(id);
              setActiveFieldId("");
              setActiveCategoryId("");
              setActiveSubCategoryId("");

              setHierarchy((prev) => ({
                ...prev,
                categories: {},
                subCategories: {},
                tags: {},
              }));

              setActiveTab("bidang");
            }}
            onRefresh={loadTypes}
          />
        </TabsContent>

        {/* Bidang */}
        <TabsContent value="bidang">
          <BidangSection
            typeId={activeTypeId}
            typeName={hierarchy.types.find(t => t.id === activeTypeId)?.name || ""}
            fields={hierarchy.fields[activeTypeId] || []}
            activeFieldId={activeFieldId}
            onFieldChange={(id) => {
              setActiveFieldId(id);
            }}
            onSelectField={() => {
              setActiveTab("kategori");
              setActiveCategoryId("");
              setActiveSubCategoryId("");
            }}
            onRefresh={() => loadFields(activeTypeId)}
          />
        </TabsContent>

        {/* Kategori */}
        <TabsContent value="kategori">
          <KategoriSection
            typeId={activeTypeId}
            typeName={hierarchy.types.find(t => t.id === activeTypeId)?.name || ""}
            fieldId={activeFieldId}
            fieldName={hierarchy.fields[activeTypeId]?.find(f => f.id === activeFieldId)?.name || ""}
            categories={hierarchy.categories[activeFieldId] || []}
            activeCategoryId={activeCategoryId}
            onCategoryChange={(id) => {
              setActiveCategoryId(id);
              setUserSelectedCategory(true);
              setActiveTab("subkategori");
            }}
            onRefresh={() => loadCategories(activeTypeId, activeFieldId)}
          />
        </TabsContent>

        {/* Sub Kategori */}
        <TabsContent value="subkategori">
          <SubKategoriSection
            typeId={activeTypeId}
            typeName={hierarchy.types.find(t => t.id === activeTypeId)?.name || ""}
            fieldName={hierarchy.fields[activeTypeId]?.find(f => f.id === activeFieldId)?.name || ""}
            categoryName={hierarchy.categories[activeFieldId]?.find(c => c.id === activeCategoryId)?.name || ""}
            categoryId={activeCategoryId}

            subCategories={hierarchy.subCategories[activeCategoryId] || []}

            onSelectSubCategory={(id) => {
              setActiveSubCategoryId(id);
              setActiveTab("tag");
            }}

            onRefresh={() => loadSubCategories(activeTypeId, activeCategoryId)}
          />
        </TabsContent>

        {/* Tags */}
        <TabsContent value="tag">
          <TagSection
            typeId={activeTypeId}
            typeName={hierarchy.types.find(t => t.id === activeTypeId)?.name || ""}

            activeFieldId={activeFieldId}
            fieldName={hierarchy.fields[activeTypeId]?.find(f => f.id === activeFieldId)?.name || ""}

            activeCategoryId={activeCategoryId}
            categoryName={hierarchy.categories[activeFieldId]?.find(c => c.id === activeCategoryId)?.name || ""}

            subCategoryId={activeSubCategoryId}
            subCategoryName={
              hierarchy.subCategories[activeCategoryId]?.find(s => s.id === activeSubCategoryId)?.name || ""
            }

            tags={hierarchy.tags[activeSubCategoryId] || []}
            onRefresh={() => loadTags(activeTypeId, activeSubCategoryId)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}