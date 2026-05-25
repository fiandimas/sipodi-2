"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import { toast } from "sonner";
import DeleteConfirmModal from "@/components/ui/common/DeleteConfirmModal";

type Props = {
  typeId: string;
  typeName: string;
  fieldId: string;
  fieldName: string;
  categories: CategoryDto[];
  activeCategoryId: string;
  onCategoryChange: (id: string, name: string) => void;
  onRefresh: () => void;
};

type CategoryDto = {
  id: string;
  name: string;
  isActive: boolean;
  fieldId: string;
  _count?: {
    subCategories: number;
    tags: number;
    submissions: number;
  };
};

export default function KategoriSectionAdmin({
  typeId,
  typeName,
  fieldId,
  fieldName,
  categories,
  activeCategoryId,
  onCategoryChange,
  onRefresh,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  /* ---------------------- CREATE ---------------------- */
  async function handleCreate() {
    if (!typeId || !fieldId)
      return toast.error("Jenis talenta dan bidang harus dipilih!");

    const name = newName.trim();
    if (!name) return toast.error("Nama kategori tidak boleh kosong");

    setLoading(true);

    try {
      const res = await fetch(`/api/admin-talenta/categories/category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId, fieldId, name }),
      });

      const json = await res.json();
      if (!res.ok) return toast.error(json.error);

      toast.success(`Kategori "${name}" berhasil ditambahkan`);
      setNewName("");
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------- UPDATE ---------------------- */
  async function handleUpdate() {
    if (!editingId) return;

    const name = editingName.trim();
    if (!name) return toast.error("Nama kategori tidak boleh kosong");

    setLoading(true);

    try {
      const res = await fetch(
        `/api/admin-talenta/categories/category/${editingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );

      const json = await res.json();
      if (!res.ok) return toast.error(json.error);

      toast.success("Kategori berhasil diperbarui");
      setEditingId(null);
      setEditingName("");
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------- DELETE ---------------------- */
  async function handleDeleteConfirmed() {
    if (!deleteId) return;

    setLoading(true);

    try {
      const res = await fetch(
        `/api/admin-talenta/categories/category/${deleteId}`,
        { method: "DELETE" }
      );

      const json = await res.json();
      if (!res.ok) return toast.error(json.error);

      toast.success(`Kategori "${deleteName}" berhasil dihapus`);

      if (activeCategoryId === deleteId) onCategoryChange("", "");

      setDeleteId(null);
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kategori per Bidang</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* INFO SECTION */}
        <div className="flex flex-wrap items-center gap-4 p-2 bg-muted/50 rounded-lg">
          <div className="flex gap-2 items-center">
            <p className="text-sm text-muted-foreground">Bidang:</p>
            <span className="text-primary font-semibold">{fieldName || "-"}</span>
          </div>

          <div className="flex gap-2 items-center">
            <p className="text-sm text-muted-foreground">Jenis Talenta:</p>
            <span className="text-primary font-semibold">{typeName || "-"}</span>
          </div>
        </div>

        {/* FORM CREATE */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Nama kategori baru"
            value={newName}
            disabled={loading || !typeId || !fieldId}
            onChange={(e) => setNewName(e.target.value)}
            className="w-80"
          />

          <Button
            size="sm"
            disabled={!newName.trim() || loading || !typeId || !fieldId}
            onClick={handleCreate}
          >
            <Plus className="w-4 h-4" /> Tambah Kategori
          </Button>
        </div>

        {/* TABLE */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-center">Subkategori</TableHead>
                <TableHead className="text-center">Tag</TableHead>
                <TableHead className="text-center">Dipakai</TableHead>
                <TableHead className="text-center w-32">Aksi</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {categories.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-6 text-center text-muted-foreground"
                  >
                    Belum ada kategori.
                  </TableCell>
                </TableRow>
              )}

              {categories.map((c) => (
                <TableRow
                  key={c.id}
                  className={`cursor-pointer transition ${activeCategoryId === c.id
                    ? "bg-accent/40"
                    : "hover:bg-muted/50"
                    }`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    onCategoryChange(c.id, c.name);
                  }}
                >
                  {/* NAMA */}
                  <TableCell>
                    {editingId === c.id ? (
                      <Input
                        value={editingName}
                        className="w-48"
                        onChange={(e) => setEditingName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      c.name
                    )}
                  </TableCell>

                  {/* SUB KATEGORI */}
                  <TableCell className="text-center">
                    {c._count?.subCategories ?? 0}
                  </TableCell>

                  {/* TAGS */}
                  <TableCell className="text-center">
                    {c._count?.tags ?? 0}
                  </TableCell>

                  {/* DIPAKAI */}
                  <TableCell className="text-center">
                    {c._count?.submissions ?? 0}
                  </TableCell>

                  {/* AKSI */}
                  <TableCell className="text-center space-x-2">
                    {editingId === c.id ? (
                      <>
                        <Button
                          size="icon"
                          variant="outline"
                          className="border-primary text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdate();
                          }}
                        >
                          <Edit2 className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          className="border-destructive text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                          }}
                        >
                          <X className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="outline"
                          className="border-primary text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(c.id);
                            setEditingName(c.name);
                          }}
                        >
                          <Edit2 className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          className="border-destructive text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(c.id);
                            setDeleteName(c.name);
                          }}
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* DELETE MODAL */}
        <DeleteConfirmModal
          open={!!deleteId}
          title="Hapus Kategori"
          description={`Yakin ingin menghapus kategori "${deleteName}"?`}
          loading={loading}
          onCancel={() => setDeleteId(null)}
          onConfirm={handleDeleteConfirmed}
        />
      </CardContent>
    </Card>
  );
}
