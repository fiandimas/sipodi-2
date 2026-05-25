// app/_lib/talent-scope.ts
import type { SessionPayload } from "./session";

export type AppSession = SessionPayload;

export function talentSubmissionScope(session: AppSession) {
  switch (session.role) {
    case "SUPER_ADMIN":
    case "ADMIN_TALENTA":
      if (session.branchId) {
        return {
          gtk: {
            school: {
              branchId: session.branchId,
            },
          },
        };
      }
      return {}; // semua cabang

    case "ADMIN_SEKOLAH":
      return {
        gtk: {
          schoolNpsn: session.schoolNpsn ?? "__NO_SCHOOL__",
        },
      };

    case "USER_GTK":
      return {
        gtkNik: session.gtkNik ?? "__NO_GTK__",
      };

    default:
      return { id: "__BLOCK__" };
  }
}
