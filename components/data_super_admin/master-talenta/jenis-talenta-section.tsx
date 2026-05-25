"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
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
  types: TalentTypeDto[];
  activeTypeId: string;
  onTypeChange: (id: string) => void;
  onRefresh: () => void;
};

type TalentTypeDto = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    typeFields: number;
    typeCategories: number;
    typeSubCategories: number;
    scopedTags: number;
    submissions: number; 
  };
};

export default function JenisTalentaSection({
  types,
  activeTypeId,
  onTypeChange,
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
    if (!name) {
      toast.error("Nama tidak boleh kosong");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Gagal membuat jenis talenta");
        return;
      }

      onRefresh();
      setNewName("");

      toast.success("Jenis talenta berhasil ditambahkan!");
    } catch {
      toast.error("Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editingId) return;

    const name = editingName.trim();
    if (!name) {
      toast.error("Nama tidak boleh kosong");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/types/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Gagal mengedit jenis talenta");
        return;
      }

      onRefresh();
      setEditingId(null);
      setEditingName("");

      toast.success("Jenis talenta berhasil diperbarui!");
    } catch {
      toast.error("Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteId) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/super-admin/types/${deleteId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Gagal menghapus");
        return;
      }

      toast.success(`Berhasil menghapus "${deleteName}"`);

      onRefresh();
      setDeleteId(null);

      if (activeTypeId === deleteId) {
        onTypeChange("");
      }

    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jenis Talenta</CardTitle>
        <CardDescription>Klik baris untuk memilih lalu tambah bidang</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* CREATE */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Nama jenis talenta baru"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-80"
            disabled={loading}
          />
          <Button
            size="sm"
            className="gap-1"
            onClick={handleCreate}
            disabled={!newName.trim() || loading}
          >
            <Plus className="w-4 h-4" />
            Tambah Jenis Talenta
          </Button>
        </div>

        {/* TABLE */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="w-32 text-center">Bidang</TableHead>
                <TableHead className="w-32 text-center">Kategori</TableHead>
                <TableHead className="w-32 text-center">Sub Kategori</TableHead>
                <TableHead className="w-32 text-center">Tag</TableHead>
                <TableHead className="w-32 text-center">Dipakai</TableHead>
                <TableHead className="w-32 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {types.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Belum ada jenis talenta.
                  </TableCell>
                </TableRow>
              )}

              {types.map((type) => (
                <TableRow
                  key={type.id}
                  className={`cursor-pointer ${activeTypeId === type.id ? "bg-accent/50" : "hover:bg-muted/50"
                    }`}
                  onClick={() => {
                    if (!editingId) onTypeChange(type.id);
                  }}
                >
                  <TableCell className="font-medium">
                    {editingId === type.id ? (
                      <Input
                        value={editingName}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-48"
                      />
                    ) : (
                      type.name
                    )}
                  </TableCell>

                  <TableCell className="text-center">{type._count?.typeFields ?? 0}</TableCell>
                  <TableCell className="text-center">{type._count?.typeCategories ?? 0}</TableCell>
                  <TableCell className="text-center">{type._count?.typeSubCategories ?? 0}</TableCell>
                  <TableCell className="text-center">{type._count?.scopedTags ?? 0}</TableCell>
                  <TableCell className="text-center">{type._count?.submissions ?? 0}</TableCell>

                  <TableCell className="text-center space-x-2">
                    {editingId === type.id ? (
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
                            setEditingName("");
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
                            setEditingId(type.id);
                            setEditingName(type.name);
                          }}
                        >
                          <Edit2 className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          className="border-destructive text-destructive h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(type.id);
                            setDeleteName(type.name);
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

        <DeleteConfirmModal
          open={!!deleteId}
          title="Hapus Jenis Talenta"
          description={`Apakah Anda yakin ingin menghapus jenis talenta "${deleteName}"?`}
          loading={loading}
          onCancel={() => setDeleteId(null)}
          onConfirm={handleDeleteConfirmed}
        />

      </CardContent>
    </Card>
  );
}
