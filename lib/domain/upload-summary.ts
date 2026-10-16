/**
 * The running "who uploaded what" list for a service: one line per person and
 * category, in the order they started uploading.
 */

export type CompletedUpload = {
  uploadedBy: string | null;
  categoryId: string;
  mimeType: string;
  completedAt: string;
};

export type UploadSummaryLine = {
  uploadedBy: string | null;
  categoryId: string;
  photos: number;
  videos: number;
};

export function isVideo(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

export function summarizeUploads(uploads: CompletedUpload[]): UploadSummaryLine[] {
  const ordered = [...uploads].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const lines = new Map<string, UploadSummaryLine>();
  for (const upload of ordered) {
    const key = `${upload.uploadedBy ?? ""}:${upload.categoryId}`;
    const line = lines.get(key) ?? {
      uploadedBy: upload.uploadedBy,
      categoryId: upload.categoryId,
      photos: 0,
      videos: 0,
    };
    if (isVideo(upload.mimeType)) line.videos += 1;
    else line.photos += 1;
    lines.set(key, line);
  }
  return [...lines.values()];
}

/** "24 photos", "1 video", "24 photos and 2 videos" */
export function countFiles(photos: number, videos: number): string {
  const parts = [];
  if (photos > 0) parts.push(`${photos} ${photos === 1 ? "photo" : "photos"}`);
  if (videos > 0) parts.push(`${videos} ${videos === 1 ? "video" : "videos"}`);
  return parts.join(" and ");
}

/**
 * Whether a service's uploads have settled enough to post. Each file finishing
 * would otherwise edit the message once per file; the app posts as soon as a
 * batch ends, and the scheduled sweep only picks up batches that went quiet.
 */
export const UPLOAD_SUMMARY_QUIET_MS = 2 * 60 * 1000;
