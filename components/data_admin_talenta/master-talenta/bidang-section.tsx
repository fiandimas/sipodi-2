"use client";

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription,
} from "@/components/ui/card";

import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from "@/components/ui/table";

type Props = {
    fields: TalentFieldDto[];
    activeFieldId: string;
    onFieldChange: (id: string, name: string) => void;
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

export default function BidangSectionAdmin({
    fields,
    activeFieldId,
    onFieldChange,
}: Props) {
    const activeField = fields.find((f) => f.id === activeFieldId);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Daftar Bidang</CardTitle>
                <CardDescription>Klik baris untuk memilih lalu tambah jenis talenta</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">

                {/* TABLE */}
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama Bidang</TableHead>
                                <TableHead className="text-center w-24">Kategori</TableHead>
                                <TableHead className="text-center w-24">Subkategori</TableHead>
                                <TableHead className="text-center w-24">Tag</TableHead>
                                <TableHead className="text-center w-24">Dipakai</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {/* TIDAK ADA DATA */}
                            {fields.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="py-6 text-center text-muted-foreground"
                                    >
                                        Tidak ada bidang yang dapat diakses.
                                    </TableCell>
                                </TableRow>
                            )}

                            {/* LIST FIELDS */}
                            {fields.map((field) => (
                                <TableRow
                                    key={field.id}
                                    onClick={() => onFieldChange(field.id, field.name)}
                                    className={`cursor-pointer transition ${activeFieldId === field.id
                                            ? "bg-accent/40"
                                            : "hover:bg-muted/50"
                                        }`}
                                >
                                    {/* NAMA */}
                                    <TableCell className="font-medium">
                                        {field.name}
                                        {!field.isActive && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                (Nonaktif)
                                            </span>
                                        )}
                                    </TableCell>

                                    {/* COUNTS */}
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
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}