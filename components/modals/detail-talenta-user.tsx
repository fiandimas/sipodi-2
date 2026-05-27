"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Pencil, Send, X, Paperclip } from "lucide-react";

type DecisionScopeClient = "SEKOLAH" | "TALENTA" | "SUPER_ADMIN" | null;
type UiStatus = "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: SubmissionItem | null;
  photoUrl?: string | null;
  gtkName?: string | null;
  schoolName?: string | null;
  onResubmit?: (id: string, data: ResubmitData) => Promise<void>;
}

export type ResubmitData = {
  activityName: string;
  organizer: string;
  description: string;
  linkPendukung: string;
  newFile: File | null;
};

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
  onResubmit,
}: Props) {
  if (!submission) return null;

  const fileId = submission.files?.[0]?.id ?? null;
  const uiStatus = getUiStatus(submission);

  const [showAllTags, setShowAllTags] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ResubmitData>({
    activityName: "",
    organizer: "",
    description: "",
    linkPendukung: "",
    newFile: null,
  });
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !submission) return;
    setIsEditing(false);
    setIsSubmitting(false);
    setFilePreview(null);
    setFormData({
      activityName: submission.activityName ?? "",
      organizer: submission.organizer ?? "",
      description: submission.description ?? "",
      linkPendukung: submission.linkPendukung ?? "",
      newFile: null,
    });
  }, [open, submission]);

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

  function handleCancelEdit() {
    setIsEditing(false);
    setFilePreview(null);
    setFormData({
      activityName: submission.activityName ?? "",
      organizer: submission.organizer ?? "",
      description: submission.description ?? "",
      linkPendukung: submission.linkPendukung ?? "",
      newFile: null,
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFormData((p) => ({ ...p, newFile: file }));
    if (file?.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  }

  async function handleSubmit() {
    if (!onResubmit) return;
    try {
      setIsSubmitting(true);
      await onResubmit(submission.id, formData);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  }

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
                    Dikembalikan pada: {formatDateTimeID(submission.rejectedAt)}
                  </div>
                )}
                {submission.rejectedBy?.name && (
                  <div className="text-xs opacity-90">
                    Oleh: {submission.rejectedBy.name}
                  </div>
                )}
              </div>
            </AlertDescription>

            <div className="mt-3 flex gap-2">
              {!isEditing ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-600 text-red-700 hover:bg-red-50"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit &amp; Kirim Ulang
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    disabled={isSubmitting}
                    className="bg-red-600 text-white hover:bg-red-700"
                    onClick={handleSubmit}
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    {isSubmitting ? "Mengirim..." : "Kirim Ulang"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isSubmitting}
                    className="text-red-700 hover:bg-red-50"
                    onClick={handleCancelEdit}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Batal
                  </Button>
                </>
              )}
            </div>
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
          {/* Nama Kegiatan */}
          {isEditing ? (
            <div>
              <Label className="text-muted-foreground">
                Nama Kegiatan <span className="text-red-500">*</span>
              </Label>
              <Input
                className="mt-1"
                value={formData.activityName}
                onChange={(e) => setFormData((p) => ({ ...p, activityName: e.target.value }))}
              />
            </div>
          ) : (
            <Item label="Nama Kegiatan" value={submission.activityName} />
          )}

          {/* Penyelenggara */}
          {isEditing ? (
            <div>
              <Label className="text-muted-foreground">Penyelenggara</Label>
              <Input
                className="mt-1"
                value={formData.organizer}
                onChange={(e) => setFormData((p) => ({ ...p, organizer: e.target.value }))}
              />
            </div>
          ) : (
            <Item label="Penyelenggara" value={submission.organizer ?? "-"} />
          )}

          {/* read-only fields — tidak berubah */}
          <Item label="Jenis Talenta" value={submission.type?.name ?? "-"} />
          <Item label="Bidang" value={submission.fieldLabel ?? "-"} />
          <Item label="Kategori" value={submission.categoryLabel ?? "-"} />
          <Item label="Sub Kategori" value={submission.subCategoryLabel ?? "-"} />

          {/* Tag — selalu read-only */}
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

          {/* Deskripsi */}
          <div className="sm:col-span-2">
            {isEditing ? (
              <>
                <Label className="text-muted-foreground">Deskripsi</Label>
                <Textarea
                  className="mt-1 min-h-[80px]"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                />
              </>
            ) : (
              <Item label="Deskripsi" value={submission.description ?? "-"} />
            )}
          </div>

          {/* Link Pendukung */}
          {isEditing ? (
            <div className="sm:col-span-2">
              <Label className="text-muted-foreground">Link Pendukung</Label>
              <Input
                className="mt-1"
                placeholder="https://"
                value={formData.linkPendukung}
                onChange={(e) => setFormData((p) => ({ ...p, linkPendukung: e.target.value }))}
              />
            </div>
          ) : (
            !!submission.linkPendukung && (
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
            )
          )}

          {/* Bukti */}
          <div className="sm:col-span-2">
            <p className="text-muted-foreground mb-2">Bukti</p>
            {isEditing ? (
              <div className="mt-1 space-y-3">
                {/* preview: file lama atau file baru */}
                <div className="relative w-fit rounded-lg border bg-muted/20 p-2">
                  {formData.newFile ? (
                    <>
                      {filePreview ? (
                        <img
                          src={filePreview}
                          alt="Preview"
                          className="max-h-48 max-w-xs rounded object-contain"
                        />
                      ) : (
                        <div className="flex h-24 w-48 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                          {formData.newFile.name}
                        </div>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formData.newFile.name} · {(formData.newFile.size / 1024).toFixed(1)} KB
                      </p>
                    </>
                  ) : fileId ? (
                    <BuktiImage fileId={fileId} compact />
                  ) : (
                    <div className="flex h-24 w-48 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                      Tidak ada bukti
                    </div>
                  )}
                </div>

                {/* tombol upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {formData.newFile ? "Ganti File" : "Upload Bukti Baru"}
                </Button>
                <p className="text-xs text-muted-foreground">Maks 2MB.</p>
              </div>
            ) : fileId ? (
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

function BuktiImage({ fileId, compact }: { fileId: string; compact?: boolean }) {
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

  const maxH = compact ? "max-h-32" : "max-h-60";

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className="group rounded-lg border bg-background p-2"
        aria-label="Lihat bukti"
      >
        {mimeType?.startsWith("image/") ? (
          <img src={url} alt="Bukti" className={`${maxH} w-auto rounded object-contain`} />
        ) : mimeType === "application/pdf" ? (
          <iframe src={url} className={`${compact ? "h-32" : "h-60"} w-full rounded border`} />
        ) : (
          <a href={url} target="_blank" className="text-blue-600 underline">
            Download File
          </a>
        )}
        {!compact && (
          <p className="mt-2 text-center text-xs text-muted-foreground">Klik untuk memperbesar</p>
        )}
      </button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Preview Bukti</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {mimeType?.startsWith("image/") ? (
              <img src={url} alt="Preview Bukti" className="max-h-[75vh] w-auto rounded object-contain" />
            ) : mimeType === "application/pdf" ? (
              <iframe src={url} className="h-[75vh] w-full rounded" />
            ) : (
              <a href={url} target="_blank" className="text-blue-600 underline">
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
