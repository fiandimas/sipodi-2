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
  TableHead,
  TableRow,
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

export default function TagSectionAdmin({
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

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  /* --------------------- CREATE --------------------- */
  async function handleCreate() {
    const name = newName.trim();
    if (!name) return toast.error("Nama tag tidak boleh kosong");

    setLoading(true);
    try {
      const res = await fetch(`/api/admin-talenta/tags/tag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId, subCategoryId, name }), // 🔥 wajib kirim typeId
      });

      const json = await res.json();
      if (!res.ok) return toast.error(json.error);

      toast.success(`Tag "${name}" berhasil ditambahkan`);
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
    if (!name) return toast.error("Nama tag tidak boleh kosong");

    setLoading(true);
    try {
      const res = await fetch(`/api/admin-talenta/tags/tag/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const json = await res.json();
      if (!res.ok) return toast.error(json.error);

      toast.success("Tag berhasil diperbarui");
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
      const res = await fetch(`/api/admin-talenta/tags/tag/${deleteId}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) return toast.error(json.error);

      toast.success(`Tag "${deleteName}" berhasil dihapus`);
      setDeleteId(null);
      onRefresh();
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

          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Sub Kategori:</p>
            <span className="text-primary font-semibold">{subCategoryName}</span>
          </div>

        </div>

        {/* FORM CREATE */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Nama tag baru"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={!subCategoryId || loading}
            className="w-80"
          />

          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newName.trim() || loading}
          >
            <Plus className="w-4 h-4" /> Tambah Tag
          </Button>
        </div>

        {/* TABLE */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-center">Dipakai</TableHead>
                <TableHead className="text-center w-32">Aksi</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {tags.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-6 text-center text-muted-foreground"
                  >
                    Belum ada tag.
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag) => (
                  <TableRow
                    key={tag.id}
                    className="hover:bg-muted/50"
                  >
                    {/* NAMA */}
                    <TableCell className="font-medium">
                      {editingId === tag.id ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-48"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        tag.name
                      )}
                    </TableCell>

                    {/* DIPAKAI */}
                    <TableCell className="text-center">
                      {tag._count?.submissions ?? 0}
                    </TableCell>

                    {/* AKSI */}
                    <TableCell className="text-center space-x-2">
                      {editingId === tag.id ? (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdate();
                            }}
                            className="border-primary text-primary"
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
                            onClick={(e) => {
                              e.stopPropagation();
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
                            onClick={(e) => {
                              e.stopPropagation();
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
