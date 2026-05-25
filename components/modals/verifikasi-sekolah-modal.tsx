"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, FileText, Image as ImageIcon } from "lucide-react";

import type { SubmissionRow } from "@/lib/types/talent-submission-admin";

type DecisionScopeClient = "SEKOLAH" | "TALENTA" | "SUPER_ADMIN" | null;
type UiStatus = "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: SubmissionRow | null;

  onApprove: () => Promise<void>;
  onReject: (note: string) => Promise<void>;

  busy?: boolean;
}

const Field = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div>
    <p className="text-sm text-muted-foreground">{label}</p>
    <div className="font-medium break-words">{value ?? "-"}</div>
  </div>
);

function formatDateTimeID(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function FilePreviewModal({
  fileId,
  open,
  onOpenChange,
}: {
  fileId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);

  useEffect(() => {
    let tempUrl: string | null = null;

    (async () => {
      const res = await fetch(`/api/admin-sekolah/talent-files/${fileId}`, {
        credentials: "same-origin",
      });

      const blob = await res.blob();

      tempUrl = URL.createObjectURL(blob);
      setUrl(tempUrl);
      setMimeType(blob.type);
    })();

    return () => {
      if (tempUrl) URL.revokeObjectURL(tempUrl);
    };
  }, [fileId]);

  if (!url) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Preview File</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center">

          {mimeType?.startsWith("image/") ? (
            <img
              src={url}
              className="max-h-[75vh] w-auto object-contain"
            />
          ) : mimeType === "application/pdf" ? (
            <iframe
              src={url}
              className="w-full h-[75vh]"
            />
          ) : (
            <a
              href={url}
              target="_blank"
              className="text-blue-600 underline"
            >
              Download File
            </a>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

function getUiStatus(s: SubmissionRow & { approvedScope?: DecisionScopeClient }): UiStatus {
  if (s.status === "REJECTED") return "REJECTED";
  if (s.status === "PENDING") return "PENDING";

  if (s.approvedScope === "SEKOLAH") return "TERVERIFIKASI";
  return "APPROVED";
}

function StatusBadge({ uiStatus }: { uiStatus: UiStatus }) {
  switch (uiStatus) {
    case "APPROVED":
      return (
        <Badge variant="outline" className="rounded-full border-sky-600 text-sky-700 bg-transparent">
          Dinilai
        </Badge>
      );

    case "TERVERIFIKASI":
      return (
        <Badge variant="outline" className="rounded-full border-emerald-600 text-emerald-700 bg-transparent">
          Verifikasi
        </Badge>
      );

    case "REJECTED":
      return (
        <Badge variant="outline" className="rounded-full border-red-600 text-red-700 bg-transparent">
          Ditinjau Ulang
        </Badge>
      );

    default:
      return (
        <Badge variant="outline" className="rounded-full border-amber-600 text-amber-700 bg-transparent">
          Belum Verifikasi
        </Badge>
      );
  }
}

export default function VerifikasiSekolahModal({ open, onOpenChange, submission, onApprove, onReject, busy }: Props) {
  const [rejectNote, setRejectNote] = useState("");

  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRejectNote(submission?.rejectionNote ?? "");
  }, [open, submission]);

  const uiStatus = useMemo(() => {
    if (!submission) return "PENDING" as const;
    return getUiStatus(submission as any);
  }, [submission]);

  const readOnly = useMemo(() => {
    // admin sekolah hanya boleh proses saat masih PENDING (status DB)
    return !submission || submission.status !== "PENDING";
  }, [submission]);

  if (!submission) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Detail & Verifikasi Talenta</DialogTitle>
        </DialogHeader>

        {/* GTK INFO */}
        <div className="flex items-center justify-between gap-4 border-b pb-4">
          <div>
            <p className="font-semibold text-lg">{submission.gtk?.name ?? "-"}</p>
            <p className="text-sm text-muted-foreground">{submission.gtk?.school?.name ?? "-"}</p>

            <div className="mt-1 flex items-center gap-2">
              <StatusBadge uiStatus={uiStatus} />
            </div>
          </div>
        </div>

        {/* DETAIL */}
        <div className="space-y-6 overflow-y-auto flex-1 pr-2">
          <div className="border rounded-lg p-4 space-y-4">
            <Field label="Nama Kegiatan" value={submission.activityName} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Penyelenggara" value={submission.organizer ?? "-"} />
              <Field label="Deskripsi" value={submission.description ?? "-"} />

              <Field label="Jenis" value={submission.type?.name ?? "-"} />
              <Field label="Bidang" value={submission.fieldLabel ?? "-"} />
              <Field label="Kategori" value={submission.categoryLabel ?? "-"} />
              <Field label="Sub Kategori" value={submission.subCategoryLabel ?? "-"} />

              <Field
                label="Tag"
                value={
                  <div className="flex flex-wrap gap-1">
                    {(submission.tagsLabel ?? []).length ? (
                      submission.tagsLabel!.map((t) => (
                        <Badge key={t} variant="secondary" className="rounded-md text-[11px]">
                          {t}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                }
              />
            </div>

            {/* BUKTI & LINK */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Bukti / File</p>

                {(submission.files ?? []).length ? (
                  <div className="space-y-2">
                    {submission.files!.map((f) => (
                      <div key={f.id} className="flex items-center justify-between rounded-md border p-2">
                        <div className="flex items-center gap-2">
                          {f.mimeType?.startsWith("image/") ? (
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <FileText className="w-4 h-4 text-muted-foreground" />
                          )}
                          <div className="text-sm">
                            <div className="font-medium">{f.originalName}</div>
                            <div className="text-xs text-muted-foreground">{Math.round(f.sizeBytes / 1024)} KB</div>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewFileId(f.id)}
                        >
                          Lihat
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Tidak ada dokumen</p>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Link Pendukung</p>

                {submission.linkPendukung ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={submission.linkPendukung} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Buka Link
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Tidak ada link</p>
                )}
              </div>
            </div>
          </div>

          {/* REJECT NOTE */}
          <div>
            <p className="text-sm text-muted-foreground">Alasan Tinjau Ulang (wajib saat tinjau ulang)</p>
            <Textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Tulis alasan penolakan..."
              className="min-h-24"
              disabled={busy || readOnly}
            />
            {readOnly ? (
              <p className="text-xs text-muted-foreground">Data sudah diproses, alasan penolakan tidak bisa diubah.</p>
            ) : null}
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-between gap-2 border-t pt-4 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Tutup
          </Button>

          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => onReject(rejectNote.trim())}
              disabled={busy || readOnly || !rejectNote.trim()}
              title={readOnly ? "Sudah diproses" : "Reject butuh alasan"}
            >
              Tinjau Ulang
            </Button>

            <Button onClick={() => onApprove()} disabled={busy || readOnly} title={readOnly ? "Sudah diproses" : "Approve"}>
              Verifikasi
            </Button>
          </div>
        </div>
      </DialogContent>

      {previewFileId && (
        <FilePreviewModal
          fileId={previewFileId}
          open={!!previewFileId}
          onOpenChange={(v) => !v && setPreviewFileId(null)}
        />
      )}

    </Dialog>
  );
}
