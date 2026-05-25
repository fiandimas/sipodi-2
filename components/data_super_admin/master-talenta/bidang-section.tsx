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
  fields: TalentFieldDto[];
  activeFieldId: string;
  onFieldChange: (id: string) => void;
  onSelectField: () => void;
  onRefresh: () => void;
};

type TalentFieldDto = {
  id: string;
  name: string;
  isActive: boolean;
  _count: {
    categories: number;
    subCategories: number;
    tags: number;
    submissions: number;
  };
};

export default function BidangSection({
  typeId,
  typeName,
  fields,
  activeFieldId,
  onFieldChange,
  onSelectField,
  onRefresh,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  // CREATE
  async function handleCreate() {
    if (!typeId) {
      toast.error("Pilih jenis talenta terlebih dahulu");
      return;
    }

    const name = newName.trim();
    if (!name) {
      toast.error("Nama bidang tidak boleh kosong");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId, name }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Gagal menambahkan bidang");
        return;
      }

      toast.success("Bidang berhasil ditambahkan!");
      setNewName("");
      await onRefresh();

      if (json.field?.id) onFieldChange(json.field.id);

    } catch {
      toast.error("Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  }

  // UPDATE
  async function handleUpdate() {
    if (!editingId) return;

    const name = editingName.trim();
    if (!name) {
      toast.error("Nama bidang tidak boleh kosong");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/fields/field/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Gagal memperbarui bidang");
        return;
      }

      toast.success("Bidang berhasil diperbarui!");
      await onRefresh();

      setEditingId(null);
      setEditingName("");

    } catch {
      toast.error("Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  }

  // DELETE
  async function handleDeleteConfirmed() {
    if (!deleteId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/fields/field/${deleteId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Bidang tidak dapat dihapus");
        return;
      }

      toast.success(`"${deleteName}" berhasil dihapus`);

      await onRefresh();

      if (activeFieldId === deleteId) onFieldChange("");

      setDeleteId(null);

    } catch {
      toast.error("Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bidang per Jenis Talenta</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 relative">

        {/* Header Info */}
        <div className="flex flex-wrap items-center gap-3 p-1 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <p className="text-sm text-normal">Jenis Talenta:</p>
            <span className="py-1 text-primary font-bold">
              {typeId ? typeName : "Belum Memilih Jenis Talenta"}
            </span>
          </div>
        </div>

        {!typeId && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Pilih jenis talenta terlebih dahulu
            </p>
          </div>
        )}

        {/* CREATE */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Nama bidang baru"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-80"
            disabled={!typeId || loading}
          />

          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newName.trim() || !typeId || loading}
          >
            <Plus className="w-4 h-4" />
            Tambah Bidang
          </Button>
        </div>

        {/* TABLE */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="w-24 text-center">Kategori</TableHead>
                <TableHead className="w-24 text-center">Subkategori</TableHead>
                <TableHead className="w-24 text-center">Tag</TableHead>
                <TableHead className="w-24 text-center">Dipakai</TableHead>
                <TableHead className="w-32 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {fields.map((field) => (
                <TableRow
                  key={field.id}
                  className={`cursor-pointer ${
                    activeFieldId === field.id
                      ? "bg-accent/40"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;

                    if (editingId) {
                      setEditingId(null);
                      setEditingName("");
                    }

                    onFieldChange(field.id);
                    onSelectField();
                  }}
                >
                  <TableCell className="font-medium">
                    {editingId === field.id ? (
                      <Input
                        value={editingName}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-48"
                      />
                    ) : (
                      field.name
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {field._count.categories}
                  </TableCell>

                  <TableCell className="text-center">
                    {field._count.subCategories}
                  </TableCell>

                  <TableCell className="text-center">
                    {field._count.tags}
                  </TableCell>

                  <TableCell className="text-center">
                    {field._count.submissions}
                  </TableCell>

                  <TableCell className="text-center space-x-2">
                    {editingId === field.id ? (
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
                            setEditingName("");
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
                            setEditingId(field.id);
                            setEditingName(field.name);
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
                            setDeleteId(field.id);
                            setDeleteName(field.name);
                          }}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2.75} absoluteStrokeWidth />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {typeId && fields.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-6 text-center text-muted-foreground"
                  >
                    Belum ada bidang untuk jenis talenta ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* DELETE MODAL */}
        <DeleteConfirmModal
          open={!!deleteId}
          title="Hapus Bidang"
          description={`Apakah Anda yakin ingin menghapus bidang "${deleteName}"?`}
          loading={loading}
          onCancel={() => setDeleteId(null)}
          onConfirm={handleDeleteConfirmed}
        />
      </CardContent>
    </Card>
  );
}
