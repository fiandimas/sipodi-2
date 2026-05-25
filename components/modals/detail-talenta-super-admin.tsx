"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

import type { TalentaSuperAdmin, DetailTalentaSuperAdmin, DecisionScope, ReviewStatus } from "@/lib/types/talenta-super-admin";

export type TalentaUpdatePayload = {
  id: string; // submission id
  skorTalenta: number;
  reviewStatus: ReviewStatus;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  talenta: TalentaSuperAdmin | null;
  onUpdated?: (payload: TalentaUpdatePayload) => void;
};

const Field = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div>
    <p className="text-sm text-muted-foreground">{label}</p>
    <div className="font-medium">{value ?? "-"}</div>
  </div>
);

const isImage = (url?: string) => !!url?.match(/\.(jpg|jpeg|png|webp)$/i);

const clampScore = (n: number) => Math.max(0, Math.min(100, Number.isNaN(n) ? 0 : n));

function formatDecisionScope(scope?: DecisionScope | null) {
  if (scope === "SEKOLAH") return "Sekolah";
  if (scope === "TALENTA") return "Admin Talenta";
  if (scope === "SUPER_ADMIN") return "Super Admin";
  return null;
}

function uiStatusOf(t: TalentaSuperAdmin): ReviewStatus {
  if (t.reviewStatus) return t.reviewStatus;

  const isRejectedByHigher =
    t.status === "REJECTED" &&
    (t.rejectedScopeResolved === "TALENTA" ||
      t.rejectedScopeResolved === "SUPER_ADMIN" ||
      t.rejectedScope === "TALENTA" ||
      t.rejectedScope === "SUPER_ADMIN");

  if (isRejectedByHigher) return "REJECTED";

  const scope = (t.approvedScopeResolved ?? t.approvedScope ?? null) as DecisionScope | null;

  const isApprovedBySchool = t.status === "APPROVED" && (scope === "SEKOLAH" || scope === null);
  const isApprovedByHigher = t.status === "APPROVED" && (scope === "TALENTA" || scope === "SUPER_ADMIN");

  if (isApprovedBySchool) return "TERVERIFIKASI";

  if (isApprovedByHigher) {
    if (t.totalSkor != null && t.totalSkor !== undefined) return "DINILAI";
    return "APPROVED";
  }

  return "PENDING";
}

function badgeClass(status: ReviewStatus) {
  if (status === "DINILAI") return "border-sky-600 text-sky-700 hover:bg-sky-50";
  if (status === "APPROVED") return "border-emerald-600 text-emerald-700 hover:bg-emerald-50";
  if (status === "TERVERIFIKASI") return "border-emerald-600 text-emerald-700 hover:bg-emerald-50";
  if (status === "REJECTED") return "border-red-600 text-red-700 hover:bg-red-50";
  return "border-amber-500 text-amber-700 hover:bg-amber-50";
}

const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  PENDING: "Pending",
  TERVERIFIKASI: "Verifikasi",
  APPROVED: "Verifikasi",
  DINILAI: "Dinilai",
  REJECTED: "Ditinjau Ulang",
  "BELUM DINILAI": "Belum dinilai",
};

function fmtDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("id-ID");
}

export default function DetailTalentaSuperAdminModal({ open, onOpenChange, talenta, onUpdated }: Props) {
  const [details, setDetails] = useState<DetailTalentaSuperAdmin[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [previewFile, setPreviewFile] = useState<{
    id: string
    mimeType: string
    name: string
  } | null>(null)

  const [expandedTagIds, setExpandedTagIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !talenta) return;

    setDetails(talenta.detailTalenta ?? []);
    setNote("");
    setBusy(false);
    setExpandedTagIds(new Set());
  }, [open, talenta]);


  function toggleTags(detailId: string) {
    setExpandedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(detailId)) next.delete(detailId);
      else next.add(detailId);
      return next;
    });
  }

  const submissionId = talenta?.id ?? null;

  const shownStatus: ReviewStatus = useMemo(
    () => (talenta ? uiStatusOf(talenta) : "PENDING"),
    [talenta],
  );

  const statusLabel = REVIEW_STATUS_LABEL[shownStatus];

  const currentScope = talenta?.approvedScopeResolved ?? talenta?.approvedScope ?? null;
  const canDecide =
    !!talenta &&
    talenta.status === "APPROVED" &&
    (currentScope === "SEKOLAH" || currentScope === "TALENTA");

  const readOnly = !canDecide;

  if (!open || !talenta) return null;

  const handleSkorChange = (id: string, raw: string) => {
    setDetails((prev) =>
      prev.map((d) => (d.id === id ? { ...d, adminScore: raw === "" ? undefined : clampScore(Number(raw)) } : d))
    );
  };

  const handleApprove = async () => {
    if (!canDecide || !submissionId) return;

    // Anda pakai skor dari detail pertama (sesuai kode Anda).
    // Kalau nanti mau per-detail, bisa dibuat average/sum.
    const skor = typeof details[0]?.adminScore === "number" ? clampScore(details[0].adminScore) : 0;

    setBusy(true);
    try {
      const res = await fetch(`/api/super-admin/talenta/${submissionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: skor, note: note.trim() || null }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        toast.error(data?.error || "Gagal approve");
        return;
      }

      onUpdated?.({
        id: submissionId,
        skorTalenta: data.computedScore ?? 0,
        reviewStatus: "DINILAI",
      });

      toast.success("Talenta di-approve");
      onOpenChange(false);
    } catch {
      toast.error("Kesalahan sistem");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!canDecide || !submissionId || !note.trim()) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/super-admin/talenta/${submissionId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        toast.error(data?.error || "Gagal reject");
        return;
      }

      onUpdated?.({
        id: submissionId,
        skorTalenta: 0,
        reviewStatus: "REJECTED",
      });

      toast.success("Talenta di-reject");
      onOpenChange(false);
    } catch {
      toast.error("Kesalahan sistem");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogContent overflow fix umum untuk konten panjang */}
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail & Verifikasi Talenta (Super Admin)</DialogTitle>
        </DialogHeader>

        {/* GTK INFO */}
        <div className="flex gap-4 border-b pb-4">
          <img
            src={talenta.gtk.fotoUrl || "/avatar.png"}
            className="w-16 h-16 rounded-full border object-cover"
            alt={talenta.gtk.nama}
          />
          <div>
            <p className="font-semibold text-lg">{talenta.gtk.nama}</p>
            <p className="text-sm text-muted-foreground">{talenta.gtk.sekolah}</p>

            <Badge variant="outline" className={`mt-1 ${badgeClass(shownStatus)}`}>
              {statusLabel}
            </Badge>

            {/* info tambahan kalau status bukan pending */}
            {!canDecide ? (
              <div className="text-xs text-muted-foreground mt-1">
                {shownStatus === "APPROVED" ? "Sudah diverifikasi (Admin Talenta / Super Admin)." : null}
                {shownStatus === "DINILAI" ? "Sudah dinilai oleh Super Admin." : null}
                {shownStatus === "REJECTED" ? "Sudah ditolak." : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* RIWAYAT KEPUTUSAN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="border rounded-md p-3 text-sm">
            <div className="text-muted-foreground mb-1">Disetujui oleh</div>
            <div className="font-medium">
              {talenta.approvedBy ? talenta.approvedBy : "-"}
              {formatDecisionScope(talenta.approvedScopeResolved ?? talenta.approvedScope)
                ? ` (${formatDecisionScope(talenta.approvedScopeResolved ?? talenta.approvedScope)})`
                : ""}
            </div>
            <div className="text-xs text-muted-foreground">{fmtDate(talenta.approvedAt) ?? ""}</div>
            {talenta.approvalNote ? (
              <div className="text-xs text-muted-foreground mt-2">
                Catatan: <span className="text-foreground">{talenta.approvalNote}</span>
              </div>
            ) : null}
          </div>

          <div className="border rounded-md p-3 text-sm">
            <div className="text-muted-foreground mb-1">Ditinjau Ulang</div>
            <div className="font-medium">
              {talenta.rejectedBy ? talenta.rejectedBy : "-"}
              {formatDecisionScope(talenta.rejectedScopeResolved ?? talenta.rejectedScope)
                ? ` (${formatDecisionScope(talenta.rejectedScopeResolved ?? talenta.rejectedScope)})`
                : ""}
            </div>
            <div className="text-xs text-muted-foreground">{fmtDate(talenta.rejectedAt) ?? ""}</div>
            {talenta.rejectionNote ? (
              <div className="text-xs text-muted-foreground mt-2">
                Catatan: <span className="text-foreground">{talenta.rejectionNote}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6 mt-4">
          {details.map((d) => {
            const tags = Array.isArray(d.tag) ? d.tag : [];
            const isExpanded = expandedTagIds.has(d.id);
            const shownTags = isExpanded ? tags : tags.slice(0, 6);
            const hiddenCount = Math.max(0, tags.length - 6);

            return (
              <div key={d.id} className="border rounded-lg p-4 space-y-4">
                <Field label="Nama Kegiatan" value={d.namaKegiatan} />

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Penyelenggara" value={d.penyelenggara} />
                  <Field label="Deskripsi" value={d.deskripsi} />
                  <Field label="Bidang" value={d.bidang} />
                  <Field label="Kategori" value={d.kategori} />
                  <Field label="Sub Kategori" value={d.subKategori} />
                </div>

                <Field
                  label="Tag"
                  value={
                    tags.length ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {shownTags.map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}

                        {hiddenCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleTags(d.id)}
                            className="text-xs underline text-muted-foreground hover:text-foreground px-1"
                          >
                            {isExpanded ? "Sembunyikan" : `+${hiddenCount} lagi`}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      "-"
                    )
                  }
                />

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Bukti / Sertifikat</p>

                  {d.files && d.files.length > 0 ? (
                    <div className="space-y-2">
                      {d.files.map((f) => (
                        <div key={f.id}>
                          {f.mimeType?.startsWith("image/") ? (
                            <img
                              src={`/api/super-admin/talent-files/${f.id}`}
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
                              {f.originalName || "Lihat Dokumen"}
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

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Skor otomatis" value={d.computedScore ?? talenta.totalSkor ?? "-"} />
                  <div>
                    <p className="text-sm text-muted-foreground">Skor Super Admin</p>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={d.adminScore === undefined || d.adminScore === null ? "" : String(d.adminScore)}
                      onChange={(e) => handleSkorChange(d.id, e.target.value)}
                      disabled={busy || readOnly}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Textarea
          className="mt-4"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan verifikasi (wajib saat tinjau ulang)"
          disabled={busy || readOnly}
        />

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Tutup
          </Button>
          <Button variant="destructive" onClick={handleReject} disabled={busy || readOnly || !note.trim()}>
            Tinjau Ulang
          </Button>
          <Button onClick={handleApprove} disabled={busy || readOnly}>
            Kirim
          </Button>
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
                  src={`/api/super-admin/talent-files/${previewFile.id}`}
                  className="max-h-[75vh] object-contain"
                />
              ) : (
                <iframe
                  src={`/api/super-admin/talent-files/${previewFile.id}`}
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
