export type TalentSubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ScoreEntryType = "CREATE_BONUS" | "APPROVAL_SCORE" | "ADJUSTMENT";

export type TalentScoreEntryDTO = {
  points: number;
  type: ScoreEntryType;
  createdAt: string; // dari API sudah ISO string
};

export type TalentSubmissionDTO = {
  id: string;
  status: TalentSubmissionStatus;
  createdAt: string;

  activityName: string;
  organizer: string | null;
  description: string | null;
  linkPendukung: string | null;

  gtk: { name: string; school: { name: string } | null } | null;

  type: { name: string } | null;
  field: { name: string } | null;
  category: { name: string } | null;
  subCategory: { name: string } | null;
  tag: { name: string } | null;

  files: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }[];

  scoreEntries: TalentScoreEntryDTO[];
};
