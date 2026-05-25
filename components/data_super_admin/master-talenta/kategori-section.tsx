// components/data_super_admin/master-talenta/kategori-section.tsx
"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import {
  Card, CardHeader, CardTitle, CardContent
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
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
  onCategoryChange: (id: string) => void;
  onRefresh: () => void;
};

// 🔥 UPDATED: tambah tags
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

export default function KategoriSection({
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

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return toast.error("Nama kategori tidak boleh kosong");

    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/categories/category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId, fieldId, name }),
      });

      const json = await res.json();
      if (!res.ok) return toast.error(json.error ?? "Gagal menambahkan kategori");

      toast.success(`Kategori "${name}" berhasil ditambahkan`);
      setNewName("");
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editingId) return;

    const name = editingName.trim();
    if (!name) return toast.error("Nama kategori tidak boleh kosong");

    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/categories/category/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const json = await res.json();
      if (!res.ok) return toast.error(json.error ?? "Gagal mengubah kategori");

      toast.success("Kategori berhasil diperbarui");
      setEditingId(null);
      setEditingName("");
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/categories/category/${deleteId}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) return toast.error(json.error ?? "Gagal menghapus kategori");

      toast.success(`Kategori "${deleteName}" berhasil dihapus`);

      onRefresh();
      if (activeCategoryId === deleteId) onCategoryChange("");

      setDeleteId(null);
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

        {/* INFO */}
        <div className="flex flex-wrap items-center gap-3 p-1 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <p className="text-sm">Jenis Talenta:</p>
            <span className="py-1 text-primary font-semibold">{typeName}</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm">Bidang:</p>
            <span className="py-1 text-primary font-semibold">{fieldName}</span>
          </div>
        </div>

        {/* FORM TAMBAH */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Nama kategori baru"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-80"
            disabled={!fieldId || loading}
          />

          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newName.trim() || loading || !fieldId}
          >
            <Plus className="w-4 h-4" />
            Tambah Kategori
          </Button>
        </div>

        {/* TABLE */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-center">Sub Kategori</TableHead>

                <TableHead className="text-center">Tags</TableHead>

                <TableHead className="text-center">Dipakai</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Belum ada kategori.
                  </TableCell>
                </TableRow>
              )}

              {categories.map((c) => (
                <TableRow
                  key={c.id}
                  className={`cursor-pointer ${activeCategoryId === c.id ? "bg-accent/40" : "hover:bg-muted/50"
                    }`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    onCategoryChange(c.id);
                  }}
                >
                  <TableCell>
                    {editingId === c.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-48"
                      />
                    ) : (
                      c.name
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {c._count?.subCategories ?? 0}
                  </TableCell>

                  <TableCell className="text-center">
                    {c._count?.tags ?? 0}
                  </TableCell>

                  <TableCell className="text-center">
                    {c._count?.submissions ?? 0}
                  </TableCell>

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
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                            setEditingName("");
                          }}
                          className="border-destructive text-destructive"
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
          description={`Apakah Anda yakin ingin menghapus kategori "${deleteName}"?`}
          loading={loading}
          onCancel={() => setDeleteId(null)}
          onConfirm={handleDeleteConfirmed}
        />
      </CardContent>
    </Card>
  );
}