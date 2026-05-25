"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
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
    types: TalentTypeDto[];
    activeTypeId: string;

    fieldId: string;
    fieldName: string;

    onTypeChange: (id: string, name: string) => void;
    onRefresh: () => void;
};

type TalentTypeDto = {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    _count?: {
        typeCategories: number;
        typeSubCategories: number;
        scopedTags: number;
        submissions: number;
    };
};

export default function JenisTalentaSectionAdmin({
    types,
    activeTypeId,
    fieldId,
    fieldName,
    onTypeChange,
    onRefresh,
}: Props) {
    const [loading, setLoading] = useState(false);
    const [newName, setNewName] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteName, setDeleteName] = useState("");

    /* CREATE */
    async function handleCreate() {
        if (!fieldId) return toast.error("Pilih bidang terlebih dahulu!");
        if (!newName.trim()) return toast.error("Nama tidak boleh kosong");

        setLoading(true);
        try {
            const res = await fetch(`/api/admin-talenta/types`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim(), fieldId }),
            });

            const json = await res.json();
            if (!res.ok) return toast.error(json.error ?? "Gagal membuat jenis talenta");

            toast.success("Jenis talenta berhasil ditambahkan!");
            setNewName("");
            onRefresh();
        } finally {
            setLoading(false);
        }
    }

    /* UPDATE */
    async function handleUpdate() {
        if (!editingId) return;

        const name = editingName.trim();
        if (!name) return toast.error("Nama tidak boleh kosong");

        setLoading(true);
        try {
            const res = await fetch(`/api/admin-talenta/types/${editingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });

            const json = await res.json();
            if (!res.ok) return toast.error(json.error ?? "Gagal memperbarui jenis talenta");

            toast.success("Jenis talenta berhasil diperbarui!");
            setEditingId(null);
            setEditingName("");
            onRefresh();
        } finally {
            setLoading(false);
        }
    }

    /* DELETE */
    async function handleDeleteConfirmed() {
        if (!deleteId) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/admin-talenta/types/${deleteId}`, {
                method: "DELETE",
            });

            const json = await res.json();
            if (!res.ok) return toast.error(json.error ?? "Gagal menghapus");

            toast.success(`Berhasil menghapus "${deleteName}"`);
            onRefresh();

            if (activeTypeId === deleteId) onTypeChange("", "");

            setDeleteId(null);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Jenis Talenta</CardTitle>

                <CardDescription>
                    Bidang dipilih:{" "}
                    <span className="font-semibold text-primary">
                        {fieldId ? fieldName : "Belum memilih bidang"}
                    </span>
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">

                {/* FORM CREATE */}
                <div className="flex flex-wrap gap-2 items-center">
                    <Input
                        placeholder="Nama jenis talenta baru"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-80"
                        disabled={loading || !fieldId}
                    />

                    <Button
                        size="sm"
                        className="gap-1"
                        onClick={handleCreate}
                        disabled={!newName.trim() || loading || !fieldId || editingId !== null}
                    >
                        <Plus className="w-4 h-4" />
                        Tambah Jenis Talenta
                    </Button>
                </div>

                {/* TABLE */}
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama</TableHead>
                                <TableHead className="text-center w-24">Kategori</TableHead>
                                <TableHead className="text-center w-32">Subkategori</TableHead>
                                <TableHead className="text-center w-24">Tag</TableHead>
                                <TableHead className="text-center w-24">Dipakai</TableHead>
                                <TableHead className="text-center w-32">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {types.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="py-6 text-center text-muted-foreground"
                                    >
                                        Belum ada jenis talenta.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                types.map((type) => (
                                    <TableRow
                                        key={type.id}
                                        className={`cursor-pointer ${activeTypeId === type.id ? "bg-accent/50" : "hover:bg-muted/50"
                                            }`}
                                        onClick={() => {
                                            if (!editingId) onTypeChange(type.id, type.name);
                                        }}
                                    >
                                        {/* NAMA */}
                                        <TableCell className="font-medium">
                                            {editingId === type.id ? (
                                                <Input
                                                    value={editingName}
                                                    className="w-48"
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                />
                                            ) : (
                                                type.name
                                            )}
                                        </TableCell>

                                        <TableCell className="text-center">
                                            {type._count?.typeCategories ?? 0}
                                        </TableCell>

                                        <TableCell className="text-center">
                                            {type._count?.typeSubCategories ?? 0}
                                        </TableCell>

                                        <TableCell className="text-center">
                                            {type._count?.scopedTags ?? 0}
                                        </TableCell>

                                        <TableCell className="text-center">
                                            {type._count?.submissions ?? 0}
                                        </TableCell>

                                        {/* AKSI */}
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
                                                        className="border-destructive text-destructive"
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
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* DELETE MODAL */}
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
