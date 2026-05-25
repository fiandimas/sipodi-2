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
import DeleteConfirmModal from "@/components/ui/common/DeleteConfirmModal";
import { toast } from "sonner";

type Props = {
  typeId: string;
  subCategoryId: string;

  typeName: string;
  fieldName: string;
  categoryName: string;
  subCategoryName: string;

  tags: TagDto[];
  activeFieldId: string;
  activeCategoryId: string;
  onRefresh: () => void;
};

type TagDto = {
  id: string;
  name: string;
  isActive: boolean;
  _count?: {
    submissions: number;
  };
};

export default function TagSection({
  typeId,
  subCategoryId,
  typeName,
  fieldName,
  categoryName,
  subCategoryName,
  tags,
  onRefresh,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Modal Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  /**
   * CREATE
   */
  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tags/tag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId, subCategoryId, name }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Gagal menambah tag");
        return;
      }

      toast.success(`Tag "${name}" berhasil ditambahkan`);
      setNewName("");
      onRefresh();
    } catch (err) {
      toast.error("Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  }

  /**
   * UPDATE
   */
  async function handleUpdate() {
    if (!editingId) return;

    const name = editingName.trim();
    if (!name) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tags/tag/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal mengubah tag");
        return;
      }

      toast.success("Tag berhasil diperbarui");

      setEditingId(null);
      setEditingName("");
      onRefresh();
    } catch {
      toast.error("Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  }

  /**
   * DELETE (modal confirm)
   */
  async function handleDeleteConfirmed() {
    if (!deleteId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tags/tag/${deleteId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Gagal menghapus tag");
        return;
      }

      toast.success(`Tag "${deleteName}" berhasil dihapus`);
      setDeleteId(null);
      onRefresh();
    } catch {
      toast.error("Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag per Sub Kategori</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* STATUS INFO */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg">

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

          <div className="flex items-center gap-2">
            <p className="text-sm">Sub Kategori:</p>
            <span className="text-primary font-semibold">
              {subCategoryName || "-"}
            </span>
          </div>

        </div>

        {/* FORM TAMBAH */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Nama tag baru"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={!subCategoryId || loading}
            className="w-80 flex-1"
          />

          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newName.trim() || !subCategoryId || loading}
          >
            <Plus className="w-4 h-4" /> Tambah
          </Button>
        </div>

        {/* TABLE */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-center">Dipakai</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {tags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Belum ada tag untuk sub kategori ini.
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell className="font-medium">
                      {editingId === tag.id ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          disabled={loading}
                          className="w-48"
                        />
                      ) : (
                        tag.name
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      {tag._count?.submissions ?? 0}
                    </TableCell>

                    <TableCell className="text-center space-x-2">
                      {editingId === tag.id ? (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={handleUpdate}
                            className="border-primary text-primary"
                          >
                            <Edit2 className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                          </Button>

                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
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
                            onClick={() => {
                              setEditingId(tag.id);
                              setEditingName(tag.name);
                            }}
                            className="border-primary text-primary"
                          >
                            <Edit2 className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                          </Button>

                          <Button
                            size="icon"
                            variant="outline"
                            className="border-destructive text-destructive"
                            onClick={() => {
                              setDeleteId(tag.id);
                              setDeleteName(tag.name);
                            }}
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
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
          title="Hapus Tag"
          description={`Apakah Anda yakin ingin menghapus tag "${deleteName}"?`}
          loading={loading}
          onCancel={() => setDeleteId(null)}
          onConfirm={handleDeleteConfirmed}
        />
      </CardContent>
    </Card>
  );
}
