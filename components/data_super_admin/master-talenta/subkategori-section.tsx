"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

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

import DeleteConfirmModal from "@/components/ui/common/DeleteConfirmModal";

type Props = {
  typeId: string;
  typeName: string;
  fieldName: string;
  categoryName: string;
  categoryId: string;

  subCategories: SubCategoryDto[];

  onRefresh: () => void;
  onSelectSubCategory: (id: string) => void;
};

type SubCategoryDto = {
  id: string;
  name: string;
  isActive: boolean;
  categoryId: string;
  _count?: {
    tags: number;
    submissions: number;
  };
};

export default function SubKategoriSection({
  typeId,
  typeName,
  fieldName,
  categoryName,
  categoryId,
  subCategories,
  onRefresh,
  onSelectSubCategory,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // DELETE MODAL
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  // CREATE
  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/super-admin/sub-categories/sub-category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeId,
          categoryId,
          name,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Gagal menambah sub kategori");
        return;
      }

      toast.success(`Sub kategori "${name}" berhasil ditambahkan!`);

      setNewName("");
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  // UPDATE
  async function handleUpdate() {
    if (!editingId) return;

    const name = editingName.trim();
    if (!name) return;

    setLoading(true);

    try {
      const res = await fetch(
        `/api/super-admin/sub-categories/sub-category/${editingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Gagal mengubah sub kategori");
        return;
      }

      toast.success(`Sub kategori berhasil diperbarui!`);

      setEditingId(null);
      setEditingName("");
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  // DELETE (modal confirm)
  async function handleDeleteConfirmed() {
    if (!deleteId) return;

    setLoading(true);

    try {
      const res = await fetch(
        `/api/super-admin/sub-categories/sub-category/${deleteId}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Gagal menghapus sub kategori");
        return;
      }

      toast.success(`Sub kategori "${deleteName}" berhasil dihapus!`);

      onRefresh();
      setDeleteId(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sub Kategori</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* Status Info */}
        <div className="flex flex-wrap items-center gap-3 p-1 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <p className="text-sm">Jenis Talenta:</p>
            <span className="text-primary font-semibold">
              {typeName || "-"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm">Bidang:</p>
            <span className="text-primary font-semibold">
              {fieldName || "-"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm">Kategori:</p>
            <span className="text-primary font-semibold">
              {categoryName || "-"}
            </span>
          </div>
        </div>

        {/* Form tambah */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Nama sub kategori baru"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-80"
            disabled={!categoryId || loading}
          />

          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newName.trim() || !categoryId || loading}
          >
            <Plus className="w-4 h-4" /> Tambah
          </Button>
        </div>

        {/* TABEL */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-center">Tag</TableHead>
                <TableHead className="text-center">Dipakai</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {subCategories.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-6 text-center text-muted-foreground"
                  >
                    Belum ada sub kategori. Tambahkan yang pertama!
                  </TableCell>
                </TableRow>
              ) : (
                subCategories.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button")) return;
                      if ((e.target as HTMLElement).closest("input")) return;
                      onSelectSubCategory(s.id);
                    }}
                  >
                    <TableCell className="font-medium">
                      {editingId === s.id ? (
                        <Input
                          value={editingName}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-48"
                        />
                      ) : (
                        s.name
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      {s._count?.tags ?? 0}
                    </TableCell>

                    <TableCell className="text-center">
                      {s._count?.submissions ?? 0}
                    </TableCell>

                    <TableCell className="text-center space-x-2">
                      {editingId === s.id ? (
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
                            <Edit2 className="h-4 w-4" strokeWidth={2.75} absoluteStrokeWidth />
                          </Button>

                          <Button
                            size="icon"
                            variant="outline"
                            className="border-destructive text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(null);
                              +   setEditingName("");
                            }}
                          >
                            <X className="h-4 w-4" strokeWidth={2.75} absoluteStrokeWidth />
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
                              setEditingId(s.id);
                              setEditingName(s.name);
                            }}
                          >
                            <Edit2 className="h-4 w-4" strokeWidth={2.75} absoluteStrokeWidth />
                          </Button>

                          <Button
                            size="icon"
                            variant="outline"
                            className="border-destructive text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(s.id);
                              setDeleteName(s.name);
                            }}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2.75} absoluteStrokeWidth />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* DELETE MODAL */}
        <DeleteConfirmModal
          open={!!deleteId}
          title="Hapus Sub Kategori"
          description={`Apakah Anda yakin ingin menghapus sub kategori "${deleteName}"?`}
          loading={loading}
          onCancel={() => setDeleteId(null)}
          onConfirm={handleDeleteConfirmed}
        />
      </CardContent>
    </Card>
  );
}
