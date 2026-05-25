"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import JenisTalentaSection from "./master-talenta/jenis-talenta-section";
import BidangSection from "./master-talenta/bidang-section";
import KategoriSection from "./master-talenta/kategori-section";
import SubKategoriSection from "./master-talenta/subkategori-section";
import TagSection from "./master-talenta/tag-section";

import type {
  TalentTypeDto,
  TalentFieldDto,
  CategoryDto,
  SubCategoryDto,
  TagDto,
} from "@/components/data_super_admin/master-talenta";

type FieldsByType = Record<string, TalentFieldDto[]>;

type Props = {
  fields: TalentFieldDto[];
};

export default function MasterTalentaPageAdminTalenta({ fields }: Props) {
  /* ============================================================
      STATE HIERARKI
  ============================================================ */
  const [hierarchy, setHierarchy] = useState({
    fields,
    types: [] as TalentTypeDto[],
    categories: {} as Record<string, CategoryDto[]>,
    subCategories: {} as Record<string, SubCategoryDto[]>,
    tags: {} as Record<string, TagDto[]>,
  });

  /* ============================================================
      STATE AKTIF
  ============================================================ */
  const [activeFieldId, setActiveFieldId] = useState("");
  const [activeFieldName, setActiveFieldName] = useState("");

  const [activeTypeId, setActiveTypeId] = useState("");
  const [activeTypeName, setActiveTypeName] = useState("");

  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [activeCategoryName, setActiveCategoryName] = useState("");

  const [activeSubCategoryId, setActiveSubCategoryId] = useState("");

  const [activeTab, setActiveTab] = useState("bidang");

  /* ============================================================
      FETCH WRAPPER
  ============================================================ */
  const fetcher = useCallback(async (url: string) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  }, []);

  /* ============================================================
      LOADER FUNCTIONS
  ============================================================ */

  const loadTypes = useCallback(
    async (fieldId: string) => {
      const data = await fetcher(`/api/admin-talenta/types?fieldId=${fieldId}`);
      setHierarchy((prev) => ({ ...prev, types: data.types }));
    },
    [fetcher]
  );

  const loadCategories = useCallback(
    async (typeId: string, fieldId: string) => {
      const data = await fetcher(
        `/api/admin-talenta/categories/${typeId}/${fieldId}`
      );

      setHierarchy((prev) => ({
        ...prev,
        categories: { ...prev.categories, [fieldId]: data.categories },
      }));
    },
    [fetcher]
  );

  const loadSubCategories = useCallback(
    async (typeId: string, categoryId: string) => {
      const data = await fetcher(
        `/api/admin-talenta/sub-categories/${typeId}/${categoryId}`
      );

      setHierarchy((prev) => ({
        ...prev,
        subCategories: {
          ...prev.subCategories,
          [categoryId]: data.subCategories,
        },
      }));
    },
    [fetcher]
  );

  const loadTags = useCallback(
    async (typeId: string, subCategoryId: string) => {
      const data = await fetcher(
        `/api/admin-talenta/tags/${typeId}/${subCategoryId}`
      );

      setHierarchy((prev) => ({
        ...prev,
        tags: { ...prev.tags, [subCategoryId]: data.tags },
      }));
    },
    [fetcher]
  );

  /* ============================================================
      RENDER
  ============================================================ */

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-4">Master Talenta</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5">
          <TabsTrigger value="bidang">Bidang</TabsTrigger>
          <TabsTrigger value="jenis-talenta" disabled={!activeFieldId}>
            Jenis Talenta
          </TabsTrigger>
          <TabsTrigger value="kategori" disabled={!activeTypeId}>
            Kategori
          </TabsTrigger>
          <TabsTrigger value="subkategori" disabled={!activeCategoryId}>
            Sub Kategori
          </TabsTrigger>
          <TabsTrigger value="tag" disabled={!activeSubCategoryId}>
            Tag
          </TabsTrigger>
        </TabsList>

        {/* ========================================================
              BIDANG
        ======================================================== */}
        <TabsContent value="bidang">
          <BidangSection
            fields={hierarchy.fields}
            activeFieldId={activeFieldId}
            onFieldChange={(id, name) => {
              setActiveFieldId(id);
              setActiveFieldName(name);

              setActiveTypeId("");
              setActiveCategoryId("");
              setActiveSubCategoryId("");

              loadTypes(id);
              setActiveTab("jenis-talenta");
            }}
          />
        </TabsContent>

        {/* ========================================================
              JENIS TALENTA
        ======================================================== */}
        <TabsContent value="jenis-talenta">
          <JenisTalentaSection
            types={hierarchy.types}
            activeTypeId={activeTypeId}
            fieldId={activeFieldId}
            fieldName={activeFieldName}
            onRefresh={() => loadTypes(activeFieldId)}
            onTypeChange={(id, name) => {
              setActiveTypeId(id);
              setActiveTypeName(name);

              setActiveCategoryId("");
              setActiveSubCategoryId("");

              loadCategories(id, activeFieldId);
              setActiveTab("kategori");
            }}
          />
        </TabsContent>

        {/* ========================================================
              KATEGORI
        ======================================================== */}
        <TabsContent value="kategori">
          <KategoriSection
            typeId={activeTypeId}
            typeName={activeTypeName}
            fieldId={activeFieldId}
            fieldName={activeFieldName}
            categories={hierarchy.categories[activeFieldId] || []}
            activeCategoryId={activeCategoryId}
            onRefresh={() => loadCategories(activeTypeId, activeFieldId)}
            onCategoryChange={(id, name) => {
              setActiveCategoryId(id);
              setActiveCategoryName(name);

              loadSubCategories(activeTypeId, id);
              setActiveTab("subkategori");
            }}
          />
        </TabsContent>

        {/* ========================================================
              SUB KATEGORI
        ======================================================== */}
        <TabsContent value="subkategori">
          <SubKategoriSection
            typeId={activeTypeId}
            typeName={activeTypeName}
            fieldName={activeFieldName}
            categoryId={activeCategoryId}
            categoryName={activeCategoryName}
            subCategories={hierarchy.subCategories[activeCategoryId] || []}
            onRefresh={() => loadSubCategories(activeTypeId, activeCategoryId)}
            onSelectSubCategory={(id) => {
              setActiveSubCategoryId(id);

              loadTags(activeTypeId, id);
              setActiveTab("tag");
            }}
          />
        </TabsContent>

        {/* ========================================================
              TAG
        ======================================================== */}
        <TabsContent value="tag">
          <TagSection
            typeId={activeTypeId}
            typeName={activeTypeName}
            fieldName={activeFieldName}
            categoryName={activeCategoryName}
            subCategoryId={activeSubCategoryId}
            subCategoryName={
              hierarchy.subCategories[activeCategoryId]?.find(
                (s) => s.id === activeSubCategoryId
              )?.name || ""
            }
            tags={hierarchy.tags[activeSubCategoryId] || []}
            onRefresh={() => loadTags(activeTypeId, activeSubCategoryId)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
