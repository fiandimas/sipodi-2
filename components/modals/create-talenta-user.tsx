"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Portal as SelectPortal } from "@radix-ui/react-select";
import { Portal as PopoverPortal } from "@radix-ui/react-popover";

type MasterType = { id: string; name: string; allowedFieldIds: string[] };
type MasterSubCategory = { id: string; name: string };
type MasterCategory = {
  id: string;
  name: string;
  subCategories: MasterSubCategory[];
};
type MasterField = { id: string; name: string; categories: MasterCategory[] };

type TalentMasterResponse = {
  types: MasterType[];
  fields: MasterField[];
};

export type CreateSubmissionResult = {
  submissionId: string;
  fileUrl: string | null;
};

interface CreateTalentaUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: CreateSubmissionResult) => void;
}

type SelectOrOther = {
  mode: "select" | "other";
  id: string;
  otherText: string;
};

type FormState = {
  activityName: string;
  organizer: string;
  description: string;

  typeId: string;

  field: SelectOrOther;
  category: SelectOrOther;
  subCategory: SelectOrOther;

  tagIds: string[];
  tagsOtherText: string[];
  tagsOtherInput: string;

  selfScore: string;

  linkPendukung: string;
  buktiFile: File | null;
};

type MasterTag = { id: string; name: string };

const OTHER_VALUE = "__OTHER__";
const MAX_TAGS = 20;

function findById<T extends { id: string }>(arr: T[] | undefined, id: string) {
  return (arr ?? []).find((x) => x.id === id) ?? null;
}

function normalizeOtherText(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function isLainnyaLabel(name: string | null | undefined) {
  return (name ?? "").toLowerCase().includes("lainnya");
}

function sortWithLainnyaLast<T extends { name: string }>(arr: T[]) {
  const copy = [...arr];
  copy.sort((a, b) => {
    const aIs = a.name.trim().toLowerCase().includes("lainnya");
    const bIs = b.name.trim().toLowerCase().includes("lainnya");
    if (aIs && !bIs) return 1;
    if (!aIs && bIs) return -1;
    return a.name.localeCompare(b.name, "id-ID");
  });
  return copy;
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function jenisScoreByTypeName(typeName: string) {
  const name = (typeName ?? "").toLowerCase();

  // Peserta (Pelatihan/Workshop/Seminar/Upskilling) => 40
  if (
    name.includes("peserta") &&
    (name.includes("pelatihan") ||
      name.includes("workshop") ||
      name.includes("seminar") ||
      name.includes("upskilling"))
  ) {
    return 40;
  }

  // Narasumber/Ahli (Pelatihan/Workshop/Seminar/Upskilling) => 80
  if (
    (name.includes("narasumber") || name.includes("ahli")) &&
    (name.includes("pelatihan") ||
      name.includes("workshop") ||
      name.includes("seminar") ||
      name.includes("upskilling"))
  ) {
    return 80;
  }

  // Pembimbing Lomba => 100
  if (name.includes("pembimbing") && name.includes("lomba")) return 100;

  // Peserta Lomba => 100
  if (name.includes("peserta") && name.includes("lomba")) return 100;

  // Minat / Bakat / Lainnya => 40
  if (name.includes("minat") || name.includes("bakat") || name.includes("lainnya"))
    return 40;

  // Fallback aman
  return 40;
}

export default function CreateTalentaUserModal({
  open,
  onOpenChange,
  onCreated,
}: CreateTalentaUserModalProps) {
  const [master, setMaster] = useState<TalentMasterResponse | null>(null);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [availableTags, setAvailableTags] = useState<MasterTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  const TYPE_ORDER: Record<string, number> = {
    "Peserta (Pelatihan / Workshop / Seminar / Upskilling)": 1,
    "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)": 2,
    "Pembimbing Lomba": 3,
    "Peserta Lomba": 4,
    "Minat / Bakat / Lainnya": 5,
  };

  function normalizeTypeLabel(raw: string) {
    const s = (raw ?? "").trim().toLowerCase();
    if (s.includes("peserta") && (s.includes("pelatihan") || s.includes("workshop") || s.includes("seminar") || s.includes("upskilling")))
      return "Peserta (Pelatihan / Workshop / Seminar / Upskilling)";
    if ((s.includes("narasumber") || s.includes("ahli")) && (s.includes("pelatihan") || s.includes("workshop") || s.includes("seminar") || s.includes("upskilling")))
      return "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)";
    if (s.includes("pembimbing") && s.includes("lomba")) return "Pembimbing Lomba";
    if (s.includes("peserta") && s.includes("lomba")) return "Peserta Lomba";
    if (s.includes("minat") || s.includes("bakat") || s.includes("lainnya")) return "Minat / Bakat / Lainnya";
    return raw?.trim() || raw;
  }

  const [preview, setPreview] = useState<string | null>(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const [form, setForm] = useState<FormState>({
    activityName: "",
    organizer: "",
    description: "",

    typeId: "",

    field: { mode: "select", id: "", otherText: "" },
    category: { mode: "select", id: "", otherText: "" },
    subCategory: { mode: "select", id: "", otherText: "" },

    tagIds: [],
    tagsOtherText: [],
    tagsOtherInput: "",

    selfScore: "",

    linkPendukung: "",
    buktiFile: null,
  });

  // ✅ FIX 1: MASTER CASCADE - Refetch saat type berubah
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingMaster(true);

        // ✅ FIXED: simple ternary - no URLSearchParams.size needed
        const url = form.typeId
          ? `/api/gtk/talent-master?typeId=${encodeURIComponent(form.typeId)}`
          : `/api/gtk/talent-master`;

        const res = await fetch(url, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!res.ok) throw new Error("Failed to load master data");
        const json = await res.json() as TalentMasterResponse;
        if (!cancelled) setMaster(json);
      } catch (e) {
        console.error(e);
        if (!cancelled) setMaster({ types: [], fields: [] });
      } finally {
        if (!cancelled) setLoadingMaster(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, form.typeId]);

  // ✅ FIX 2: TAGS CASCADE - Context-aware
  useEffect(() => {
    const typeId = form.typeId;
    const subCategoryId = form.subCategory.mode === "select" ? form.subCategory.id : "";

    if (!typeId || !subCategoryId) {
      setAvailableTags([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingTags(true);
        const params = new URLSearchParams({ typeId, subCategoryId });
        const res = await fetch(`/api/gtk/talent-tags?${params}`, {
          cache: "no-store",
          credentials: "same-origin",
        });

        const json = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(json?.error ?? "Failed to load tags");

        if (!cancelled) setAvailableTags((json?.tags ?? []) as MasterTag[]);
      } catch (e) {
        console.error(e);
        if (!cancelled) setAvailableTags([]);
      } finally {
        if (!cancelled) setLoadingTags(false);
      }
    })();

    return () => { cancelled = true; };
  }, [form.typeId, form.subCategory.id, form.subCategory.mode]);

  const selectedType = useMemo(
    () => findById(master?.types, form.typeId),
    [master, form.typeId]
  );

  // ===== Allowed fields by selected type =====
  const allowedFields = useMemo(() => {
    const all = master?.fields ?? [];
    if (!selectedType) return [];
    const allow = new Set(selectedType.allowedFieldIds ?? []);
    const filtered = all.filter((f) => allow.has(f.id));
    return sortWithLainnyaLast(filtered);
  }, [master?.fields, selectedType]);

  const selectedField = useMemo(() => {
    if (form.field.mode !== "select") return null;
    return findById(master?.fields, form.field.id);
  }, [master, form.field]);

  const sortedCategories = useMemo(() => {
    return sortWithLainnyaLast(selectedField?.categories ?? []);
  }, [selectedField?.categories]);

  const selectedCategory = useMemo(() => {
    if (!selectedField) return null;
    if (form.category.mode !== "select") return null;
    return findById(selectedField.categories, form.category.id);
  }, [selectedField, form.category]);

  const sortedSubCategories = useMemo(() => {
    return sortWithLainnyaLast(selectedCategory?.subCategories ?? []);
  }, [selectedCategory?.subCategories]);

  const selectedSubCategory = useMemo(() => {
    if (!selectedCategory) return null;
    if (form.subCategory.mode !== "select") return null;
    return findById(selectedCategory.subCategories, form.subCategory.id);
  }, [selectedCategory, form.subCategory]);

  useEffect(() => {
    const typeId = form.typeId;
    const subCategoryId = form.subCategory.mode === "select" ? form.subCategory.id : "";

    if (!typeId || !subCategoryId) {
      setAvailableTags([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingTags(true);
        const params = new URLSearchParams({
          typeId,
          subCategoryId
        });

        const res = await fetch(`/api/gtk/talent-tags?${params}`, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        const json = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(json?.error ?? "Failed to load tags");

        if (!cancelled) setAvailableTags((json?.tags ?? []) as MasterTag[]);
      } catch (e) {
        console.error(e);
        if (!cancelled) setAvailableTags([]);
      } finally {
        if (!cancelled) setLoadingTags(false);
      }
    })();

    return () => { cancelled = true; };
  }, [form.typeId, form.subCategory.id, form.subCategory.mode]);

  useEffect(() => {
    setForm((p) => ({
      ...p,
      tagIds: p.tagIds.filter((id) => availableTags.some((t) => t.id === id)),
    }));
  }, [availableTags]);

  const selectedTagsLabel = useMemo(() => {
    const fromMaster = form.tagIds
      .map((id) => availableTags.find((t) => t.id === id)?.name)
      .filter(Boolean) as string[];
    return [...fromMaster, ...form.tagsOtherText];
  }, [form.tagIds, form.tagsOtherText, availableTags]);

  const totalTagsCount = form.tagIds.length + form.tagsOtherText.length;
  const tagsRemaining = Math.max(0, MAX_TAGS - totalTagsCount);

  const resetForm = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setAvailableTags([]);
    setLoadingTags(false);

    setForm({
      activityName: "",
      organizer: "",
      description: "",

      typeId: "",

      field: { mode: "select", id: "", otherText: "" },
      category: { mode: "select", id: "", otherText: "" },
      subCategory: { mode: "select", id: "", otherText: "" },

      tagIds: [],
      tagsOtherText: [],
      tagsOtherInput: "",

      selfScore: "",

      linkPendukung: "",
      buktiFile: null,
    });
  };

  const MAX_FILE_BYTES = 2 * 1024 * 1024;

  const handleFileChange = (file?: File) => {
    if (!file) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Bukti harus berupa JPG, PNG, atau PDF");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      alert("Ukuran bukti maksimal 2MB");
      return;
    }

    if (preview) URL.revokeObjectURL(preview);

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }

    setForm((prev) => ({ ...prev, buktiFile: file }));
  };

  const addOtherTagChip = () => {
    const v = normalizeOtherText(form.tagsOtherInput);
    if (!v) return;

    if (totalTagsCount >= MAX_TAGS) {
      alert(`Maksimal ${MAX_TAGS} tag.`);
      return;
    }

    setForm((p) => {
      const exists = p.tagsOtherText.some(
        (x) => x.toLowerCase() === v.toLowerCase()
      );
      if (exists) return { ...p, tagsOtherInput: "" };
      return {
        ...p,
        tagsOtherText: [...p.tagsOtherText, v],
        tagsOtherInput: "",
      };
    });
  };

  const removeOtherTagChip = (text: string) => {
    setForm((p) => ({
      ...p,
      tagsOtherText: p.tagsOtherText.filter((x) => x !== text),
    }));
  };

  const toggleTagId = (id: string) => {
    setForm((p) => {
      const exists = p.tagIds.includes(id);
      if (exists) {
        return { ...p, tagIds: p.tagIds.filter((x) => x !== id) };
      }
      if (p.tagIds.length + p.tagsOtherText.length >= MAX_TAGS) {
        alert(`Maksimal ${MAX_TAGS} tag.`);
        return p;
      }
      return { ...p, tagIds: [...p.tagIds, id] };
    });
  };

  const clearTags = () => {
    setForm((p) => ({
      ...p,
      tagIds: [],
      tagsOtherText: [],
      tagsOtherInput: "",
    }));
  };

  const isFieldRequired = true;

  const isCategoryRequired = useMemo(() => {
    const name = (selectedType?.name ?? "").toLowerCase();
    return (
      (name.includes("peserta") && name.includes("pelatihan")) ||
      name.includes("narasumber") ||
      name.includes("ahli") ||
      (name.includes("pembimbing") && name.includes("lomba")) ||
      (name.includes("peserta") && name.includes("lomba")) ||
      name.includes("minat") ||
      name.includes("bakat")
    );
  }, [selectedType?.name]);

  const isSubCategoryRequired = useMemo(() => {
    const name = (selectedType?.name ?? "").toLowerCase();
    return (
      (name.includes("pembimbing") && name.includes("lomba")) ||
      (name.includes("peserta") && name.includes("lomba"))
    );
  }, [selectedType?.name]);

  // ===== Preview scoring =====
  const selfScoreValue = useMemo(() => {
    const n = Number(form.selfScore);
    if (!Number.isFinite(n)) return 0;
    return clampInt(Math.floor(n), 0, 100);
  }, [form.selfScore]);

  const tagScoreValue = useMemo(() => {
    return clampInt(totalTagsCount * 5, 0, 100);
  }, [totalTagsCount]);

  // ✅ NEW: jenisScore preview from selected type name
  const jenisScoreValue = useMemo(() => {
    if (!selectedType?.name) return 0;
    return jenisScoreByTypeName(selectedType.name);
  }, [selectedType?.name]);

  const previewTotalWeighted = useMemo(() => {
    // 20% self + 25% tag + 25% jenis (+ admin 0 saat create)
    return 0.2 * selfScoreValue + 0.25 * tagScoreValue + 0.25 * jenisScoreValue;
  }, [selfScoreValue, tagScoreValue, jenisScoreValue]);

  const handleSubmit = async () => {
    if (!form.activityName.trim() || !form.typeId) {
      alert("Nama kegiatan dan jenis talenta wajib diisi");
      return;
    }

    const selfN = Number(form.selfScore);
    if (!Number.isFinite(selfN) || selfN < 1 || selfN > 100) {
      alert("Self Score wajib diisi (1-100)");
      return;
    }

    if (isFieldRequired) {
      const ok =
        (form.field.mode === "select" && !!form.field.id) ||
        (form.field.mode === "other" && !!normalizeOtherText(form.field.otherText));
      if (!ok) {
        alert("Bidang wajib diisi");
        return;
      }
    }

    if (isCategoryRequired) {
      const ok =
        (form.category.mode === "select" && !!form.category.id) ||
        (form.category.mode === "other" &&
          !!normalizeOtherText(form.category.otherText));
      if (!ok) {
        alert("Kategori wajib diisi");
        return;
      }
    }

    if (isSubCategoryRequired) {
      const ok =
        (form.subCategory.mode === "select" && !!form.subCategory.id) ||
        (form.subCategory.mode === "other" &&
          !!normalizeOtherText(form.subCategory.otherText));
      if (!ok) {
        alert("Sub Kategori wajib diisi");
        return;
      }
    }

    if (form.tagIds.length === 0 && form.tagsOtherText.length === 0) {
      alert("Tambahkan minimal 1 tag (pilih dari daftar atau ketik manual)");
      return;
    }

    if (totalTagsCount > MAX_TAGS) {
      alert(`Maksimal ${MAX_TAGS} tag.`);
      return;
    }

    try {
      setSubmitting(true);

      const fd = new FormData();
      fd.set("typeId", form.typeId);
      fd.set("activityName", form.activityName.trim());

      fd.set("selfScore", String(clampInt(Math.floor(selfN), 1, 100)));

      if (form.field.mode === "select" && form.field.id) fd.set("fieldId", form.field.id);
      if (form.field.mode === "other" && normalizeOtherText(form.field.otherText))
        fd.set("fieldOtherText", normalizeOtherText(form.field.otherText));

      if (form.category.mode === "select" && form.category.id)
        fd.set("categoryId", form.category.id);
      if (form.category.mode === "other" && normalizeOtherText(form.category.otherText))
        fd.set("categoryOtherText", normalizeOtherText(form.category.otherText));

      if (form.subCategory.mode === "select" && form.subCategory.id)
        fd.set("subCategoryId", form.subCategory.id);
      if (form.subCategory.mode === "other" && normalizeOtherText(form.subCategory.otherText))
        fd.set("subCategoryOtherText", normalizeOtherText(form.subCategory.otherText));

      for (const id of form.tagIds) fd.append("tagIds", id);
      for (const t of form.tagsOtherText) fd.append("tagsOtherText", t);

      if (form.organizer.trim()) fd.set("organizer", form.organizer.trim());
      if (form.description.trim()) fd.set("description", form.description.trim());
      if (form.linkPendukung.trim()) fd.set("linkPendukung", form.linkPendukung.trim());
      if (form.buktiFile) fd.set("file", form.buktiFile);

      const res = await fetch("/api/gtk/talent-submissions", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert((json as any)?.error ?? "Gagal menyimpan talenta");
        return;
      }

      onCreated(json as CreateSubmissionResult);
      onOpenChange(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan saat menyimpan");
    } finally {
      setSubmitting(false);
    }
  };

  const summaryText = useMemo(() => {
    const parts: string[] = [];
    if (selectedType) parts.push(`Jenis: ${selectedType.name}`);
    if (form.selfScore.trim()) parts.push(`Self: ${selfScoreValue}`);

    if (form.field.mode === "select" && selectedField) parts.push(`Bidang: ${selectedField.name}`);
    if (form.field.mode === "other" && form.field.otherText.trim())
      parts.push(`Bidang: ${normalizeOtherText(form.field.otherText)}`);

    if (form.category.mode === "select" && selectedCategory)
      parts.push(`Kategori: ${selectedCategory.name}`);
    if (form.category.mode === "other" && form.category.otherText.trim())
      parts.push(`Kategori: ${normalizeOtherText(form.category.otherText)}`);

    if (form.subCategory.mode === "select" && selectedSubCategory)
      parts.push(`Sub: ${selectedSubCategory.name}`);
    if (form.subCategory.mode === "other" && form.subCategory.otherText.trim())
      parts.push(`Sub: ${normalizeOtherText(form.subCategory.otherText)}`);

    if (selectedTagsLabel.length) parts.push(`Tag: ${selectedTagsLabel.join(", ")}`);

    return parts.join(" • ");
  }, [
    selectedType,
    selectedField,
    selectedCategory,
    selectedSubCategory,
    form.field,
    form.category,
    form.subCategory,
    form.selfScore,
    selfScoreValue,
    selectedTagsLabel,
  ]);

  const canPickField = !!selectedType;
  const canPickCategory = form.field.mode === "select" && !!selectedField;
  const canPickSubCategory = form.category.mode === "select" && !!selectedCategory;

  const masterTagEnabled =
    !!form.typeId &&
    form.subCategory.mode === "select" &&
    !!form.subCategory.id &&
    !loadingTags &&
    availableTags.length > 0;

  const masterTagHelper = useMemo(() => {

    if (form.subCategory.mode === "other") {
      return "Sub kategori manual: tag master tidak tersedia. Gunakan Tag lainnya.";
    }
    if (!selectedSubCategory) return "Pilih sub kategori dahulu. Atau langsung isi Tag lainnya.";
    if (isLainnyaLabel(selectedSubCategory.name))
      return `Sub kategori Lainnya: boleh pilih tag master atau ketik manual. Maks ${MAX_TAGS} tag (sisa ${tagsRemaining}).`;
    if (!availableTags.length)
      return "Tidak ada tag master untuk sub kategori ini. Gunakan Tag lainnya.";
    return `Klik item untuk toggle. Maks ${MAX_TAGS} tag (sisa ${tagsRemaining}).`;
  }, [form.subCategory.mode, selectedSubCategory, availableTags.length, tagsRemaining]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Talenta</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="text-sm text-muted-foreground">
            {summaryText || "Lengkapi data lalu simpan."}
          </div>
          <Badge variant="secondary">
            {loadingMaster ? "Memuat master..." : "Form Talenta"}
          </Badge>
        </div>

        {/* ✅ Preview skor */}
        <div className="rounded-lg border p-4 bg-amber-50/40">
          <div className="flex items-center justify-between">
            <div className="font-medium">Preview Skor (Weighted)</div>
            <Badge variant="outline">20% Self + 25% Tag + 25% Jenis</Badge>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-4 text-sm">
            <div className="flex justify-between sm:block">
              <div className="text-muted-foreground">Self</div>
              <div className="font-semibold tabular-nums">{selfScoreValue}</div>
            </div>

            <div className="flex justify-between sm:block">
              <div className="text-muted-foreground">Tag</div>
              <div className="font-semibold tabular-nums">
                {tagScoreValue} ({totalTagsCount}/{MAX_TAGS})
              </div>
            </div>

            <div className="flex justify-between sm:block">
              <div className="text-muted-foreground">Jenis</div>
              <div className="font-semibold tabular-nums">{jenisScoreValue}</div>
            </div>

            <div className="flex justify-between sm:block">
              <div className="text-muted-foreground">Total</div>
              <div className="font-bold tabular-nums">{previewTotalWeighted.toFixed(1)}</div>
            </div>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Catatan: Admin Score (30%) diisi setelah submit oleh Admin Talenta/Cabang Dinas.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left */}
          <div className="space-y-5">
            <div>
              <Label>Nama Kegiatan *</Label>
              <Input
                value={form.activityName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, activityName: e.target.value }))
                }
                placeholder="Contoh: Workshop AI untuk Guru"
              />
            </div>

            <div>
              <Label>Deskripsi</Label>
              <Textarea
                rows={6}
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Ringkas kegiatan, peran, hasil, dsb."
              />
            </div>

            <div>
              <Label>Penyelenggara</Label>
              <Input
                value={form.organizer}
                onChange={(e) =>
                  setForm((p) => ({ ...p, organizer: e.target.value }))
                }
                placeholder="Contoh: Dinas Pendidikan / Komunitas"
              />
            </div>

            <div>
              <Label>Self Score (1–100) *</Label>
              <Input
                inputMode="numeric"
                value={form.selfScore}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, "");
                  setForm((p) => ({ ...p, selfScore: raw }));
                }}
                placeholder="Contoh: 85"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Nilai penilaian diri. Akan dipakai sebagai komponen 20% skor.
              </p>
            </div>

            <div>
              <Label>Link Pendukung</Label>
              <Input
                type="url"
                placeholder="https://contoh.com"
                value={form.linkPendukung}
                onChange={(e) =>
                  setForm((p) => ({ ...p, linkPendukung: e.target.value }))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Opsional. Bisa link sertifikat, publikasi, dokumentasi.
              </p>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Jenis Talenta *</Label>
                <Select
                  value={form.typeId}
                  onValueChange={(v) => {
                    setForm((p) => ({
                      ...p,
                      typeId: v,
                      field: { mode: "select", id: "", otherText: "" },
                      category: { mode: "select", id: "", otherText: "" },
                      subCategory: { mode: "select", id: "", otherText: "" },
                      tagIds: [],
                      tagsOtherText: [],
                      tagsOtherInput: "",
                    }));
                  }}
                  disabled={loadingMaster || !master}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingMaster ? "Memuat..." : "Pilih Jenis"}
                    />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectContent className="max-h-72 overflow-auto">
                      {(master?.types ?? [])
                        .slice()
                        .sort((a, b) => {
                          const ao = TYPE_ORDER[normalizeTypeLabel(a.name)] ?? 999;
                          const bo = TYPE_ORDER[normalizeTypeLabel(b.name)] ?? 999;
                          if (ao !== bo) return ao - bo;
                          return a.name.localeCompare(b.name, "id-ID");
                        })
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </div>

              {/* Bidang */}
              <div className="sm:col-span-2">
                <Label>Bidang {isFieldRequired ? "*" : ""}</Label>
                <Select
                  value={form.field.mode === "select" ? form.field.id : OTHER_VALUE}
                  onValueChange={(v) => {
                    if (v === OTHER_VALUE) {
                      setForm((p) => ({
                        ...p,
                        field: { mode: "other", id: "", otherText: "" },
                        category: { mode: "select", id: "", otherText: "" },
                        subCategory: { mode: "select", id: "", otherText: "" },
                        tagIds: [],
                        tagsOtherText: [],
                        tagsOtherInput: "",
                      }));
                      return;
                    }
                    setForm((p) => ({
                      ...p,
                      field: { mode: "select", id: v, otherText: "" },
                      category: { mode: "select", id: "", otherText: "" },
                      subCategory: { mode: "select", id: "", otherText: "" },
                      tagIds: [],
                      tagsOtherText: [],
                      tagsOtherInput: "",
                    }));
                  }}
                  disabled={loadingMaster || !master || !canPickField}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !canPickField
                          ? "Pilih jenis dulu"
                          : loadingMaster
                            ? "Memuat..."
                            : "Pilih Bidang"
                      }
                    />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectContent className="max-h-72 overflow-auto">
                      {(allowedFields ?? []).map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectPortal>
                </Select>

                {form.field.mode === "other" && (
                  <div className="mt-2">
                    <Input
                      placeholder="Tulis bidang lainnya"
                      value={form.field.otherText}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          field: { ...p.field, otherText: e.target.value },
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              {/* Kategori */}
              <div className="sm:col-span-2">
                <Label>Kategori {isCategoryRequired ? "*" : ""}</Label>
                <Select
                  value={
                    form.category.mode === "select" ? form.category.id : OTHER_VALUE
                  }
                  onValueChange={(v) => {
                    if (v === OTHER_VALUE) {
                      setForm((p) => ({
                        ...p,
                        category: { mode: "other", id: "", otherText: "" },
                        subCategory: { mode: "select", id: "", otherText: "" },
                        tagIds: [],
                        tagsOtherText: [],
                        tagsOtherInput: "",
                      }));
                      return;
                    }
                    setForm((p) => ({
                      ...p,
                      category: { mode: "select", id: v, otherText: "" },
                      subCategory: { mode: "select", id: "", otherText: "" },
                      tagIds: [],
                      tagsOtherText: [],
                      tagsOtherInput: "",
                    }));
                  }}
                  disabled={!canPickCategory}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={canPickCategory ? "Pilih Kategori" : "Pilih bidang dulu"}
                    />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectContent className="max-h-72 overflow-auto">
                      {sortedCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectPortal>
                </Select>

                {form.category.mode === "other" && (
                  <div className="mt-2">
                    <Input
                      placeholder="Tulis kategori lainnya"
                      value={form.category.otherText}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          category: { ...p.category, otherText: e.target.value },
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              {/* Sub Kategori */}
              <div className="sm:col-span-2">
                <Label>Sub Kategori {isSubCategoryRequired ? "*" : ""}</Label>
                <Select
                  value={
                    form.subCategory.mode === "select"
                      ? form.subCategory.id
                      : OTHER_VALUE
                  }
                  onValueChange={(v) => {
                    if (v === OTHER_VALUE) {
                      setForm((p) => ({
                        ...p,
                        subCategory: { mode: "other", id: "", otherText: "" },
                        tagIds: [],
                        tagsOtherText: [],
                        tagsOtherInput: "",
                      }));
                      return;
                    }
                    setForm((p) => ({
                      ...p,
                      subCategory: { mode: "select", id: v, otherText: "" },
                      tagIds: [],
                      tagsOtherText: [],
                      tagsOtherInput: "",
                    }));
                  }}
                  disabled={!canPickSubCategory}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        canPickSubCategory ? "Pilih Sub Kategori" : "Pilih kategori dulu"
                      }
                    />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectContent className="max-h-72 overflow-auto">
                      {sortedSubCategories.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER_VALUE}>Tidak Ada Pilihan</SelectItem>
                    </SelectContent>
                  </SelectPortal>
                </Select>

                {form.subCategory.mode === "other" && (
                  <div className="mt-2">
                    <Input
                      placeholder="Tulis sub kategori lainnya"
                      value={form.subCategory.otherText}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          subCategory: { ...p.subCategory, otherText: e.target.value },
                        }))
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="block">Tag *</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {totalTagsCount}/{MAX_TAGS}
                  </Badge>
                  <Button type="button" size="sm" variant="outline" onClick={clearTags}>
                    Clear
                  </Button>
                </div>
              </div>

              {selectedTagsLabel.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.tagIds.map((id) => {
                    const name = availableTags.find((t) => t.id === id)?.name ?? id;
                    return (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => toggleTagId(id)}
                      >
                        {name} (hapus)
                      </Badge>
                    );
                  })}

                  {form.tagsOtherText.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => removeOtherTagChip(t)}
                    >
                      {t} (hapus)
                    </Badge>
                  ))}
                </div>
              )}

              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">
                  Pilih dari daftar (multi)
                </Label>

                <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-between"
                      disabled={!masterTagEnabled}
                    >
                      {loadingTags
                        ? "Memuat tag..."
                        : form.subCategory.mode === "other"
                          ? "Tag master tidak tersedia"
                          : !selectedSubCategory
                            ? "Pilih tag"
                            : availableTags.length
                              ? "Pilih tag..."
                              : "Tidak ada tag master"}
                    </Button>
                  </PopoverTrigger>

                  <PopoverPortal>
                    <PopoverContent
                      className="p-0 w-[340px]"
                      align="start"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      <Command className="max-h-80 overflow-y-auto">
                        <CommandInput placeholder="Cari tag..." />
                        <CommandList>
                          <CommandEmpty>Tag tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {availableTags.map((t) => {
                              const checked = form.tagIds.includes(t.id);
                              return (
                                <CommandItem
                                  key={t.id}
                                  value={t.name}
                                  onSelect={() => toggleTagId(t.id)}
                                >
                                  <span className="mr-2">{checked ? "✓" : ""}</span>
                                  {t.name}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </PopoverPortal>
                </Popover>

                <p className="text-xs text-muted-foreground">{masterTagHelper}</p>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">
                  Tag lainnya
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={form.tagsOtherInput}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, tagsOtherInput: e.target.value }))
                    }
                    placeholder="Contoh: Nasional / Kabupaten / Juara 1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOtherTagChip();
                      }
                    }}
                    disabled={totalTagsCount >= MAX_TAGS}
                  />
                  <Button
                    type="button"
                    onClick={addOtherTagChip}
                    disabled={totalTagsCount >= MAX_TAGS}
                  >
                    Tambah
                  </Button>
                </div>
              </div>
            </div>

            {/* Upload */}
            <div>
              <Label>Bukti Pendukung (Gambar / PDF)</Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
              {preview && (
                <img
                  src={preview}
                  className="mt-2 max-h-44 rounded-lg border object-contain"
                  alt="Preview bukti"
                />
              )}
              {form.buktiFile?.type === "application/pdf" && (
                <div className="mt-2 text-sm text-muted-foreground">
                  File PDF dipilih: {form.buktiFile.name}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Maks 2MB.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan Talenta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
