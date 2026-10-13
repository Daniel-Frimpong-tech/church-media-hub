import type { DashboardData } from "@/components/dashboard/types";
import type { ShellUpload, ShellUser } from "@/components/shell/app-shell";
import type { HandoffRow } from "@/lib/handoffs";

/**
 * Sample data for the preview pages (/preview/…), which exist only in local
 * development. They render the real screens without signing in or a database,
 * so the design can be seen and adjusted. Photos are placeholders from
 * picsum.photos; nothing here is real church data.
 */

const photo = (seed: string, size = 400) =>
  `https://picsum.photos/seed/rcw-${seed}/${size}/${size}`;

export const previewUser: ShellUser = {
  name: "Ama Owusu",
  email: "ama.owusu@example.com",
  role: "admin",
};

const handoff = (overrides: Partial<HandoffRow>): HandoffRow => ({
  id: "h1",
  serviceId: "s1",
  serviceName: "Sunday Service",
  serviceStartsAt: "2025-10-12T17:00:00Z",
  categoryName: "Preacher",
  categorySlug: "preacher",
  teamName: "Thumbnails",
  dueAt: "2025-10-13T17:00:00Z",
  stage: "ready",
  deliveredLate: false,
  receivedAt: null,
  canConfirm: true,
  ...overrides,
});

export const previewDashboard: DashboardData = {
  firstName: "Ama",
  role: "admin",
  greeting: "Good afternoon",
  today: "Wednesday, October 15",
  googleProblem: null,
  viewerWithoutTeam: false,
  canManage: true,
  canUpload: true,
  focus: {
    id: "s1",
    name: "Sunday Service",
    dateLine: "Sun, Oct 12, 2025 · 10:00 AM",
    relative: "3 days ago",
    when: "recent",
    covers: [photo("a"), photo("b"), photo("c"), photo("d")],
    fileCount: 184,
    assigned: ["Grace Mensah", "Sam Boateng", "Kofi Asante"],
    tasksDone: 2,
    tasksTotal: 4,
    missing: 1,
  },
  myTasks: [
    {
      assignmentId: "a1",
      categoryId: "c1",
      categoryName: "Fellowship",
      serviceId: "s1",
      serviceName: "Sunday Service",
      dateLine: "Sun, Oct 12, 2025",
      nothingUploaded: true,
    },
    {
      assignmentId: "a1",
      categoryId: "c2",
      categoryName: "Baptism",
      serviceId: "s1",
      serviceName: "Sunday Service",
      dateLine: "Sun, Oct 12, 2025",
      nothingUploaded: false,
    },
  ],
  handoffs: [
    handoff({ id: "h1", stage: "late", categoryName: "Videos", categorySlug: "videos", teamName: "Website" }),
    handoff({ id: "h2", stage: "ready", categoryName: "Baptism", categorySlug: "baptism", teamName: "Social Media" }),
    handoff({ id: "h3", stage: "waiting", categoryName: "Fellowship", categorySlug: "fellowship", teamName: "Social Media", canConfirm: false }),
  ],
  lateHandoffs: 1,
  recentUploads: ["e", "f", "g", "h", "i", "j", "k", "l"].map((seed, index) => ({
    id: seed,
    thumbUrl: photo(seed),
    fileName: `IMG_41${index}.jpg`,
    isVideo: index === 2,
    href: "/preview/dashboard",
    caption: ["Preacher · Grace", "Baptism · Grace", "Videos · Sam", "Fellowship · Kofi"][index % 4],
  })),
  upcoming: [
    {
      id: "s2",
      name: "Midweek Prayer",
      dateLine: "Wed, Oct 15, 2025 · 7:30 PM",
      relative: "Today",
      assigned: ["Sam Boateng"],
      missing: 0,
      foldersFailed: false,
    },
    {
      id: "s3",
      name: "Sunday Service",
      dateLine: "Sun, Oct 19, 2025 · 10:00 AM",
      relative: "In 4 days",
      assigned: ["Grace Mensah", "Sam Boateng", "Kofi Asante", "Ama Owusu", "Tola Adeyemi"],
      missing: 5,
      foldersFailed: false,
    },
    {
      id: "s4",
      name: "Baptism Sunday",
      dateLine: "Sun, Oct 26, 2025 · 10:00 AM",
      relative: "In 11 days",
      assigned: [],
      missing: 0,
      foldersFailed: false,
    },
  ],
  analytics: {
    totalFiles: 12940,
    totalBytes: 412 * 1024 ** 3,
    last30Days: 1284,
    previous30Days: 1071,
    photos: 2310,
    videos: 46,
    weekly: [
      ["Aug 24", 212], ["Aug 31", 264], ["Sep 7", 198], ["Sep 14", 305],
      ["Sep 21", 0], ["Sep 28", 341], ["Oct 5", 287], ["Oct 12", 184],
    ].map(([label, files]) => ({
      weekStart: String(label),
      label: String(label),
      files: Number(files),
    })),
    byCategory: [
      { name: "Preacher", files: 902 },
      { name: "Fellowship", files: 731 },
      { name: "Baptism", files: 512 },
      { name: "Videos", files: 46 },
    ],
    byPerson: [
      { name: "Grace Mensah", files: 1104 },
      { name: "Kofi Asante", files: 688 },
      { name: "Sam Boateng", files: 352 },
      { name: "Ama Owusu", files: 47 },
    ],
    handoffs: {
      settled: 31,
      onTime: 26,
      late: 5,
      onTimeRate: 26 / 31,
      medianHoursToDeliver: 19,
    },
  },
};

/** A brand-new workspace: nothing created, Google not connected. */
export const previewEmptyDashboard: DashboardData = {
  ...previewDashboard,
  greeting: "Good morning",
  googleProblem: "not_connected",
  focus: null,
  myTasks: [],
  handoffs: [],
  lateHandoffs: 0,
  recentUploads: [],
  upcoming: [],
  analytics: null,
};

const CATEGORIES = [
  { id: "c1", name: "Baptism" },
  { id: "c2", name: "Preacher" },
  { id: "c3", name: "Fellowship" },
  { id: "c4", name: "Videos" },
];

export const previewUpload: ShellUpload = {
  defaultServiceId: "s1",
  services: [
    { id: "s1", name: "Sunday Service", dateLine: "Sun, Oct 12", relative: "3 days ago", categories: CATEGORIES },
    { id: "s2", name: "Midweek Prayer", dateLine: "Wed, Oct 15", relative: "Today", categories: CATEGORIES },
    { id: "s3", name: "Sunday Service", dateLine: "Sun, Oct 19", relative: "In 4 days", categories: CATEGORIES },
  ],
};
