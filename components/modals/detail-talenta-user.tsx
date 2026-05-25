"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type DecisionScopeClient = "SEKOLAH" | "TALENTA" | "SUPER_ADMIN" | null;
type UiStatus = "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: SubmissionItem | null;
  photoUrl?: string | null;
  gtkName?: string | null;
  schoolName?: string | null;
}

export type SubmissionItem = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;

  activityName: string;
  organizer: string | null;
  description: string | null;
  linkPendukung: string | null;

  approvedScope?: DecisionScopeClient;
  approvedAt?: string | null;
  approvedBy?: { name: string } | null;

  rejectedScope?: DecisionScopeClient;
  rejectedAt?: string | null;
  rejectionNote?: string | null;
  rejectedBy?: { name: string } | null;

  type: { name: string };

  field: { name: string } | null;
  category: { name: string } | null;
  subCategory: { name: string } | null;

  fieldOtherText: string | null;
  categoryOtherText: string | null;
  subCategoryOtherText: string | null;

  tags: { id: string; name: string }[];
  tagsOtherText: string[];

  fieldLabel: string | null;
  categoryLabel: string | null;
  subCategoryLabel: string | null;
  tagsLabel: string[];

  gtk?: { name: string; school?: { name: string } | null } | null;

  files: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }[];
  scoreEntries: {
    points: number;
    type: "CREATE_BONUS" | "APPROVAL_SCORE" | "ADJUSTMENT";
    createdAt: string;
  }[];
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: SubmissionItem | null;
}

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

function getUiStatus(s: SubmissionItem): UiStatus {
  if (s.status === "REJECTED") return "REJECTED";
  if (s.status === "PENDING") return "PENDING";

  // status === "APPROVED"
  if (s.approvedScope === "SEKOLAH") return "TERVERIFIKASI";
  return "APPROVED";
}

function StatusBadge({ uiStatus }: { uiStatus: UiStatus }) {
  switch (uiStatus) {
    case "APPROVED":
      return (
        <Badge
          variant="outline"
          className="rounded-full border-sky-600 text-sky-700 bg-transparent px-2.5 py-0.5 text-xs"
        >
          Dinilai
        </Badge>
      );

    case "TERVERIFIKASI":
      return (
        <Badge
          variant="outline"
          className="rounded-full border-emerald-600 text-emerald-700 bg-transparent px-2.5 py-0.5 text-xs"
        >
          Verifikasi
        </Badge>
      );

    case "REJECTED":
      return (
        <Badge
          variant="outline"
          className="rounded-full border-red-600 text-red-700 bg-transparent px-2.5 py-0.5 text-xs"
        >
          Tinjau Ulang
        </Badge>
      );

    default:
      return (
        <Badge
          variant="outline"
          className="rounded-full border-amber-600 text-amber-700 bg-transparent px-2.5 py-0.5 text-xs"
        >
          Belum Verifikasi
        </Badge>
      );
  }
}

function statusLabel(uiStatus: UiStatus) {
  if (uiStatus === "APPROVED") return "Dinilai";
  if (uiStatus === "TERVERIFIKASI") return "Verifikasi";
  if (uiStatus === "REJECTED") return "Tinjau Ulang";
  return "Belum Verifikasi";
}

export default function DetailTalentaUserModal({
  open,
  onOpenChange,
  submission,
  photoUrl,
  gtkName,
  schoolName,
}: Props) {
  if (!submission) return null;

  const fileId = submission.files?.[0]?.id ?? null;
  const uiStatus = getUiStatus(submission);

  const [showAllTags, setShowAllTags] = useState(false);

  const tags = submission.tagsLabel ?? [];
  const shownTags = showAllTags ? tags : tags.slice(0, 6);
  const moreCount = Math.max(0, tags.length - 6);

  const rejectMessage =
    submission.rejectionNote && submission.rejectionNote.trim()
      ? submission.rejectionNote.trim()
      : "Tidak ada alasan penolakan.";

  const approvedScopeLabel =
    submission.approvedScope === "SEKOLAH"
      ? "oleh sekolah"
      : submission.approvedScope === "TALENTA"
        ? "oleh talenta"
        : submission.approvedScope === "SUPER_ADMIN"
          ? "oleh super admin"
          : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="relative pr-8">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="leading-tight">Detail Talenta</DialogTitle>
            <StatusBadge uiStatus={uiStatus} />
          </div>
          <div className="flex items-center gap-4">
            <img
              src={photoUrl ?? "/avatar.png"}
              className="h-14 w-14 rounded-full border object-cover"
              alt={gtkName ?? "GTK"}
            />
            <div>
              <DialogTitle className="text-base font-semibold">
                {gtkName ?? submission.gtk?.name ?? "-"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {schoolName ?? submission.gtk?.school?.name ?? "-"}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* PESAN REJECT */}
        {submission.status === "REJECTED" ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Talenta Ditinjau Ulang</AlertTitle>
            <AlertDescription>
              <div className="space-y-1">
                <div className="whitespace-pre-wrap break-words">
                  Keterangan: {rejectMessage}
                </div>

                {submission.rejectedAt && (
                  <div className="text-xs opacity-90">
                    Dikembalikan  pada: {formatDateTimeID(submission.rejectedAt)}
                  </div>
                )}

                {submission.rejectedBy?.name && (
                  <div className="text-xs opacity-90">
                    Oleh: {submission.rejectedBy.name}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        ) : submission.status === "APPROVED" && submission.approvedAt ? (
          <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground">
              {uiStatus === "TERVERIFIKASI" ? "Diverifikasi oleh" : "Dinilai oleh"}
            </p>
            <p className="font-medium">
              {submission.approvedBy?.name ?? "-"}
              <span className="ml-1 text-xs text-muted-foreground">
                ({formatDateTimeID(submission.approvedAt)}
                {approvedScopeLabel ? ` · ${approvedScopeLabel}` : ""}
                )
              </span>
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <Item label="Nama Kegiatan" value={submission.activityName} />
          <Item label="Penyelenggara" value={submission.organizer ?? "-"} />

          <Item label="Jenis Talenta" value={submission.type?.name ?? "-"} />
          <Item label="Bidang" value={submission.fieldLabel ?? "-"} />

          <Item label="Kategori" value={submission.categoryLabel ?? "-"} />
          <Item label="Sub Kategori" value={submission.subCategoryLabel ?? "-"} />

          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Tag</p>

            {tags.length ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  {shownTags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="max-w-[220px] truncate"
                      title={t}
                    >
                      {t}
                    </Badge>
                  ))}
                </div>

                {moreCount > 0 ? (
                  <button
                    type="button"
                    className="mt-2 text-xs text-muted-foreground underline"
                    onClick={() => setShowAllTags((v) => !v)}
                  >
                    {showAllTags ? "Tampilkan lebih sedikit" : `+${moreCount} lagi`}
                  </button>
                ) : null}
              </>
            ) : (
              <p className="font-medium">-</p>
            )}
          </div>

          <Item label="Status" value={statusLabel(uiStatus)} />

          <div className="sm:col-span-2">
            <Item label="Deskripsi" value={submission.description ?? "-"} />
          </div>

          {!!submission.linkPendukung && (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Link Pendukung</p>
              <a
                href={submission.linkPendukung}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline break-all"
              >
                {submission.linkPendukung}
              </a>
            </div>
          )}

          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Bukti</p>
            {fileId ? (
              <div className="mt-2 flex justify-center">
                <BuktiImage fileId={fileId} />
              </div>
            ) : (
              <p className="font-medium">-</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BuktiImage({ fileId }: { fileId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let tempUrl: string | null = null;

    (async () => {
      setErr(null);
      setUrl(null);

      const res = await fetch(`/api/gtk/talent-files/${fileId}`, {
        credentials: "same-origin",
      });

      if (!res.ok) {
        setErr(`Gagal memuat bukti (${res.status})`);
        return;
      }

      const blob = await res.blob();
      tempUrl = URL.createObjectURL(blob);

      setUrl(tempUrl);
      setMimeType(blob.type);
    })();

    return () => {
      if (tempUrl) URL.revokeObjectURL(tempUrl);
    };
  }, [fileId]);

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!url) return <div className="text-sm text-muted-foreground">Memuat bukti...</div>;

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className="group rounded-lg border bg-background p-2"
        aria-label="Lihat bukti"
      >
        {mimeType?.startsWith("image/") ? (
          <img
            src={url}
            alt="Bukti"
            className="max-h-60 w-auto rounded object-contain"
          />
        ) : mimeType === "application/pdf" ? (
          <iframe
            src={url}
            className="h-60 w-full rounded border"
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
        <p className="mt-2 text-center text-xs text-muted-foreground">Klik untuk memperbesar</p>
      </button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Preview Bukti</DialogTitle>
          </DialogHeader>

          <div className="flex justify-center">
            {mimeType?.startsWith("image/") ? (
              <img
                src={url}
                alt="Preview Bukti"
                className="max-h-[75vh] w-auto rounded object-contain"
              />
            ) : mimeType === "application/pdf" ? (
              <iframe
                src={url}
                className="h-[75vh] w-full rounded"
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
    </>
  );
}

function Item({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}
