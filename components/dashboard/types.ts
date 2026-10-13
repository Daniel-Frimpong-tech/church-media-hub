import type { WeekBucket } from "@/lib/domain/analytics";
import type { Role } from "@/lib/domain/permissions";
import type { HandoffRow } from "@/lib/handoffs";

/** Everything the home page shows, already worked out. The view only draws it. */
export type DashboardData = {
  firstName: string;
  role: Role;
  greeting: string;
  /** "Wednesday, October 15" */
  today: string;

  googleProblem: "not_connected" | "expired" | null;
  viewerWithoutTeam: boolean;

  focus: FocusService | null;
  myTasks: MyTask[];
  handoffs: HandoffRow[];
  lateHandoffs: number;
  recentUploads: RecentUpload[];
  upcoming: UpcomingService[];
  /** Null for people who have nothing to analyse yet. */
  analytics: Analytics | null;
  canManage: boolean;
  canUpload: boolean;
};

export type FocusService = {
  id: string;
  name: string;
  /** "Sun, Oct 12, 2025 · 10:00 AM" */
  dateLine: string;
  /** "Today", "In 3 days", "Yesterday" */
  relative: string;
  when: "now" | "upcoming" | "recent";
  /** Up to four thumbnail URLs. */
  covers: string[];
  fileCount: number;
  assigned: string[];
  tasksDone: number;
  tasksTotal: number;
  /** Tasks with nothing uploaded and not marked done. */
  missing: number;
};

export type MyTask = {
  assignmentId: string;
  categoryId: string;
  categoryName: string;
  serviceId: string;
  serviceName: string;
  /** "Sun, Oct 12, 2025" */
  dateLine: string;
  /** False when they uploaded but have not marked it done. */
  nothingUploaded: boolean;
};

export type RecentUpload = {
  id: string;
  thumbUrl: string;
  fileName: string;
  isVideo: boolean;
  /** Where tapping it goes: the album it is in. */
  href: string;
  /** "Preacher · Grace" */
  caption: string;
};

export type UpcomingService = {
  id: string;
  name: string;
  dateLine: string;
  relative: string;
  assigned: string[];
  missing: number;
  foldersFailed: boolean;
};

export type Analytics = {
  totalFiles: number;
  totalBytes: number;
  last30Days: number;
  previous30Days: number;
  photos: number;
  videos: number;
  weekly: WeekBucket[];
  byCategory: { name: string; files: number }[];
  byPerson: { name: string; files: number }[];
  handoffs: {
    settled: number;
    onTime: number;
    late: number;
    onTimeRate: number | null;
    medianHoursToDeliver: number | null;
  };
};
