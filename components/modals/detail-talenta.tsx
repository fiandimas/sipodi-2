"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, FileText } from "lucide-react";

import type { TalentaAdmin, TalentaDetailAdmin } from "@/lib/types/talenta-admin";

type TalentaUpdatePayload = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

type DetailTalentaModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  talenta: TalentaAdmin | null;
  fieldId?: string;
  onAfterUpdate?: (payload: TalentaUpdatePayload) => void;
};

type DecisionScopeClient = "SEKOLAH" | "TALENTA" | "SUPER_ADMIN" | null;
type UiStatus = "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED" | "DINILAI";

const Field = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div>
    <p className="text-sm text-muted-foreground">{label}</p>
    <div className="font-medium">{value ?? "-"}</div>
  </div>
);

const isImage = (url?: string) => !!url?.match(/\.(jpg|jpeg|png|webp)$/i);

function clampScore(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function formatDecisionScope(scope: DecisionScopeClient) {
  if (!scope) return null;
  if (scope === "SEKOLAH") return "Sekolah";
  if (scope === "TALENTA") return "Admin Talenta";
  if (scope === "SUPER_ADMIN") return "Super Admin";
  return null;
}

function getUiStatus(item: TalentaAdmin): UiStatus {
  if (item.reviewStatus) return item.reviewStatus as UiStatus;

  if (item.status === "REJECTED") return "REJECTED";
  if (item.status === "PENDING") return "PENDING";

  const scope = (item as any).approvedScopeResolved ?? (item as any).approvedScope ?? null;
  if (scope === "SEKOLAH" || scope === null) return "TERVERIFIKASI";
  return "APPROVED";
}

function getReviewStatus(t: TalentaAdmin): "BELUM DINILAI" | "DINILAI" | "REJECTED" {
  const s = t.reviewStatus as any;

  if (s === "DINILAI" || s === "APPROVED") return "DINILAI";
  if (s === "REJECTED") return "REJECTED";
  return "BELUM DINILAI";
}

function reviewStatusLabel(s: "BELUM DINILAI" | "DINILAI" | "REJECTED") {
  if (s === "REJECTED") return "Ditinjau Ulang";
  if (s === "DINILAI") return "Dinilai";
  return "Belum dinilai";
}

export default function DetailTalentaModal({
  open, onOpenChange, talenta, fieldId, onAfterUpdate
}: DetailTalentaModalProps) {
  const [details, setDetails] = useState<TalentaDetailAdmin[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [previewFile, setPreviewFile] = useState<{
    id: string
    mimeType: string
    name: string
  } | null>(null)

  useEffect(() => {
    if (talenta && open) {
      setDetails(talenta.detailTalenta);
      setNote("");
      setBusy(false);
    }
  }, [talenta, open]);

  const firstDetail = details[0];

  const reviewStatus = useMemo(() => {
    if (!talenta) return "BELUM DINILAI" as const;
    return getReviewStatus(talenta);
  }, [talenta]);

  const uiStatus = useMemo(() => {
    if (!talenta) return "PENDING" as const;
    return getUiStatus(talenta as any);
  }, [talenta]);

  const readOnly = useMemo(() => {
    return !talenta || reviewStatus !== "BELUM DINILAI";
  }, [talenta, reviewStatus]);

  if (!talenta) return null;

  const approvedScopeLabel = formatDecisionScope((talenta as any).approvedScope ?? null);
  const rejectedScopeLabel = formatDecisionScope(
    ((talenta as any).rejectedScopeResolved ?? (talenta as any).rejectedScope) as DecisionScopeClient
  );

  const handleSkorChange = (id: string, raw: string) => {
    setDetails((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
            ...d,
            skorAdmin: raw === "" ? undefined : clampScore(Number(raw)),
          }
          : d
      )
    );
  };

  function renderUiStatusBadge() {
    if (uiStatus === "DINILAI" || uiStatus === "APPROVED") {
      return (
        <Badge
          className="mt-1 bg-sky-600 text-white hover:bg-sky-600"
          title={approvedScopeLabel ? `Dinilai oleh: ${approvedScopeLabel}` : ""}
        >
          Dinilai
        </Badge>
      );
    }

    if (uiStatus === "TERVERIFIKASI") {
      return (
        <Badge className="mt-1 bg-emerald-600 text-white hover:bg-emerald-600" title="Disetujui oleh Sekolah">
          Verifikasi
        </Badge>
      );
    }

    if (uiStatus === "REJECTED") {
      return (
        <Badge variant="destructive" className="mt-1" title={rejectedScopeLabel ? `Dikembalikan Ulang oleh: ${rejectedScopeLabel}` : ""}>
          Ditinjau Ulang
        </Badge>
      );
    }

    return (
      <Badge className="mt-1 bg-amber-500 hover:bg-amber-500 text-white" title="Belum diproses sekolah">
        Belum verifikasi
      </Badge>
    );
  }

  const handleApprove = async () => {
    if (readOnly) return;

    const points =
      firstDetail && typeof firstDetail.skorAdmin === "number" && !Number.isNaN(firstDetail.skorAdmin)
        ? clampScore(firstDetail.skorAdmin)
        : 0;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin-talenta/talent-submissions/${talenta.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points,
          note: note.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error("Gagal approve talenta:", err);
        return;
      }

      onAfterUpdate?.({ id: talenta.id, status: "APPROVED" });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (readOnly) return;

    const trimmed = note.trim();
    if (!trimmed) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin-talenta/talent-submissions/${talenta.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: trimmed,
          fieldId: fieldId
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error("Gagal reject talenta:", err);
        return;
      }

      onAfterUpdate?.({ id: talenta.id, status: "REJECTED" });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Detail & Verifikasi Talenta</DialogTitle>
        </DialogHeader>

        {/* GTK INFO */}
        <div className="flex items-center gap-4 border-b pb-4">
          <img
            src={talenta.gtk.fotoUrl || "/avatar.png"}
            className="w-16 h-16 rounded-full border object-cover"
            alt={talenta.gtk.nama}
          />
          <div>
            <p className="font-semibold text-lg">{talenta.gtk.nama}</p>
            <p className="text-sm text-muted-foreground">{talenta.gtk.sekolah}</p>
            {renderUiStatusBadge()}

            <div className="mt-1 text-xs text-muted-foreground">
              Status review admin talenta:{" "}
              <span className="font-medium">
                {reviewStatusLabel(reviewStatus)}
              </span>
            </div>

          </div>
        </div>

        {/* tampilkan alasan reject jika DB rejected */}
        {talenta.status === "REJECTED" && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="text-muted-foreground">Catatan Tinjau Ulang</div>
            <div className="font-medium">{(talenta as any).rejectionNote || "-"}</div>
          </div>
        )}

        {/* DETAIL TALENTA */}
        <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-1">
          {details.map((d) => (
            <div key={d.id} className="border rounded-lg p-4 space-y-4">
              <Field label="Nama Kegiatan" value={d.namaKegiatan} />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Penyelenggara" value={d.penyelenggara} />
                <Field label="Deskripsi" value={d.deskripsi} />
                <Field label="Bidang" value={d.bidang} />
                <Field label="Kategori" value={d.kategori} />
                <Field label="Sub Kategori" value={d.subKategori} />

                <Field
                  label="Tag"
                  value={
                    d.tag && d.tag.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {d.tag.map((t) => (
                          <Badge key={t} variant="secondary" className="rounded-md text-[11px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )
                  }
                />
              </div>

              {/* BUKTI & LINK */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Bukti / Sertifikat</p>

                  {d.files && d.files.length > 0 ? (
                    <div className="space-y-2">
                      {d.files.map((f) => (
                        <div key={f.id}>
                          {f.mimeType?.startsWith("image/") ? (
                            <img
                              src={`/api/admin-talenta/talent-files/${f.id}`}
                              alt={f.originalName}
                              className="max-h-48 rounded-md border object-contain hover:opacity-90 cursor-pointer"
                              onClick={() =>
                                setPreviewFile({
                                  id: f.id,
                                  mimeType: f.mimeType,
                                  name: f.originalName,
                                })
                              }
                            />
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setPreviewFile({
                                  id: f.id,
                                  mimeType: f.mimeType,
                                  name: f.originalName,
                                })
                              }
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Lihat Dokumen
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Tidak ada dokumen</p>
                  )}
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Link Pendukung</p>

                  {d.linkPendukung ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={d.linkPendukung} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Buka Link
                      </a>
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">Tidak ada link</p>
                  )}
                </div>
              </div>

              {/* SKOR */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-sm text-muted-foreground">Skor otomatis</p>
                  <p className="text-lg font-semibold">{d.skorOtomatis ?? "-"}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Skor admin talenta</p>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    placeholder="Masukkan skor admin talenta (0-100)"
                    value={d.skorAdmin === undefined || d.skorAdmin === null ? "" : String(d.skorAdmin)}
                    onChange={(e) => handleSkorChange(d.id, e.target.value)}
                    disabled={busy || readOnly}
                  />
                  {readOnly && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Skor hanya bisa diubah saat status review admin talenta masih belum dinilai.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Catatan verifikasi */}
        <div className="space-y-2 pt-2" >
          <p className="text-sm text-muted-foreground">Catatan verifikasi (wajib saat Tinjau Ulang)</p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tulis catatan verifikasi / alasan penolakan..."
            className="min-h-24"
            disabled={busy || readOnly}
          />
        </div>

        {/* FOOTER */}
        <div className="flex justify-between gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Tutup
          </Button>

          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={busy || readOnly || !note.trim()}
              title={readOnly ? "Sudah diproses" : "Reject butuh alasan"}
            >
              Tinjau Ulang
            </Button>

            <Button onClick={handleApprove} disabled={busy || readOnly}>
              Kirim
            </Button>
          </div>
        </div>
      </DialogContent>

      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
          </DialogHeader>

          {previewFile && (
            <div className="flex justify-center">
              {previewFile.mimeType.startsWith("image/") ? (
                <img
                  src={`/api/admin-talenta/talent-files/${previewFile.id}`}
                  className="max-h-[75vh] object-contain"
                />
              ) : (
                <iframe
                  src={`/api/admin-talenta/talent-files/${previewFile.id}`}
                  className="w-full h-[75vh] border rounded"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </Dialog>
  );
}