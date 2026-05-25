export type Status = "PENDING" | "APPROVED" | "REJECTED";

export type DecisionScopeClient = "SEKOLAH" | "TALENTA" | "SUPER_ADMIN" | null;

export type SimpleUser = {
  id: string;
  name: string;
  username: string;
  role: string;
};

export type SubmissionFile = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

export type ScoreEntry = {
  id?: string;
  points: number;
  type?: string;
  createdAt?: string;
  note?: string | null;
};

export type SubmissionRow = {
  id: string;
  status: Status;
  createdAt: string;

  // approval
  approvedAt: string | null;
  approvalNote: string | null;
  approvedBy?: SimpleUser | null;

  // ✅ scope approval/reject (tambahkan ini)
  approvedScope?: DecisionScopeClient;
  rejectedScope?: DecisionScopeClient;

  // reject
  rejectedAt?: string | null;
  rejectionNote?: string | null;
  rejectedBy?: SimpleUser | null;

  activityName: string;
  organizer: string | null;
  description: string | null;
  linkPendukung: string | null;

  fieldLabel: string | null;
  categoryLabel: string | null;
  subCategoryLabel: string | null;
  tagsLabel?: string[];

  type?: { id?: string; name: string } | null;

  gtk?: {
    nik?: string;
    name: string;
    mapel?: string | null;

    school?: {
      npsn?: string;
      name: string;
      headName?: string | null;
      headRank?: string | null;
      headNip?: string | null;
    };
  } | null;

  files?: SubmissionFile[];
  scoreEntries?: ScoreEntry[];

  computedScore?: number | null;
};
