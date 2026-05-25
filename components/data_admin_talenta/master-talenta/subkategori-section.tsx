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
  fieldName: string;
  categoryId: string;
  categoryName: string;
  subCategories: SubCategoryDto[];
  onSelectSubCategory: (id: string, name: string) => void;
  onRefresh: () => void;
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

export default function SubKategoriSectionAdmin({
  typeId,
  typeName,
  fieldName,
  categoryId,
  categoryName,
  subCategories,
  onSelectSubCategory,
  onRefresh,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  /* --------------------- CREATE --------------------- */
  async function handleCreate() {
    const name = newName.trim();
    if (!name) return toast.error("Nama sub kategori tidak boleh kosong");

    setLoading(true);
    try {
      const res = await fetch(`/api/admin-talenta/sub-categories/sub-category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId, categoryId, name }), // 🔥 wajib kirim typeId
      });

      const json = await res.json();
      if (!res.ok) return toast.error(json.error);

      toast.success(`Sub kategori "${name}" berhasil ditambahkan`);
      setNewName("");
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  /* --------------------- UPDATE --------------------- */
  async function handleUpdate() {
    if (!editingId) return;

    const name = editingName.trim();
    if (!name) return toast.error("Nama sub kategori tidak boleh kosong");

    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin-talenta/sub-categories/sub-category/${editingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );

      const json = await res.json();
      if (!res.ok) return toast.error(json.error);

      toast.success("Sub kategori berhasil diperbarui");
      setEditingId(null);
      setEditingName("");
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  /* --------------------- DELETE --------------------- */
  async function handleDeleteConfirmed() {
    if (!deleteId) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin-talenta/sub-categories/sub-category/${deleteId}`,
        { method: "DELETE" }
      );

      const json = await res.json();
      if (!res.ok) return toast.error(json.error);

      toast.success(`Sub kategori "${deleteName}" berhasil dihapus`);
      setDeleteId(null);
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sub Kategori per Kategori</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* HEADER INFO */}
        <div className="flex flex-wrap gap-3 p-2 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Bidang:</p>
            <span className="text-primary font-semibold">{fieldName}</span>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Jenis Talenta:</p>
            <span className="text-primary font-semibold">{typeName}</span>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Kategori:</p>
            <span className="text-primary font-semibold">{categoryName}</span>
          </div>
        </div>

        {/* FORM CREATE */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Nama sub kategori baru"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-80"
            disabled={loading}
          />

          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newName.trim() || loading}
          >
            <Plus className="w-4 h-4" /> Tambah Sub Kategori
          </Button>
        </div>

        {/* TABLE */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-center">Tags</TableHead>
                <TableHead className="text-center">Dipakai</TableHead>
                <TableHead className="text-center w-32">Aksi</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {subCategories.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-muted-foreground"
                  >
                    Belum ada sub kategori.
                  </TableCell>
                </TableRow>
              )}

              {subCategories.map((sc) => (
                <TableRow
                  key={sc.id}
                  className={`cursor-pointer ${editingId === sc.id
                    ? "bg-accent/40"
                    : "hover:bg-muted/50"
                    }`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    onSelectSubCategory(sc.id, sc.name);
                  }}
                >
                  {/* NAMA */}
                  <TableCell>
                    {editingId === sc.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-48"
                      />
                    ) : (
                      sc.name
                    )}
                  </TableCell>

                  {/* TAGS */}
                  <TableCell className="text-center">
                    {sc._count?.tags ?? 0}
                  </TableCell>

                  {/* DIPAKAI */}
                  <TableCell className="text-center">
                    {sc._count?.submissions ?? 0}
                  </TableCell>

                  {/* AKSI */}
                  <TableCell className="text-center space-x-2">
                    {editingId === sc.id ? (
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
                            setEditingId(sc.id);
                            setEditingName(sc.name);
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
                            setDeleteId(sc.id);
                            setDeleteName(sc.name);
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