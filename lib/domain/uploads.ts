/**
 * Rules for uploads that both the browser and the server apply. The server
 * never trusts the browser's answer; it runs the same checks again.
 */

/** Google requires every chunk except the last to be a multiple of 256 KiB. */
const CHUNK_UNIT = 256 * 1024;
/** 8 MiB: small enough to retry cheaply on mobile data, big enough to be quick. */
export const CHUNK_SIZE = 32 * CHUNK_UNIT;

/** Generous for phone video, and far below Drive's own per-file limit. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024 * 1024;

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  dng: "image/x-adobe-dng",
  cr2: "image/x-canon-cr2",
  cr3: "image/x-canon-cr3",
  nef: "image/x-nikon-nef",
  arw: "image/x-sony-arw",
  raf: "image/x-fuji-raf",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
  mts: "video/mp2t",
  "3gp": "video/3gpp",
};

/**
 * The file's media type. Phones sometimes report an empty type (HEIC and
 * camera raw files especially), so fall back to the extension.
 */
export function resolveMimeType(fileName: string, reportedType: string): string | null {
  const reported = reportedType.trim().toLowerCase();
  if (reported.startsWith("image/") || reported.startsWith("video/")) {
    return reported;
  }
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? null;
}

export function isVideo(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

/** Keeps the name people recognise, minus anything unsafe or overlong. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    // Control characters and path separators.
    .replace(/[\u0000-\u001f\u007f/\\]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /^\.+$/.test(cleaned)) return "upload";
  if (cleaned.length <= 200) return cleaned;

  // Too long: shorten the stem but keep the extension.
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 200 - extension.length) + extension;
}

export type UploadCheck =
  | { ok: true; fileName: string; mimeType: string }
  | { ok: false; error: string };

export function checkUpload(file: {
  name: string;
  type: string;
  size: number;
}): UploadCheck {
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    return { ok: false, error: "This file is empty." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "This file is larger than 20 GB." };
  }
  const mimeType = resolveMimeType(file.name, file.type);
  if (!mimeType) {
    return { ok: false, error: "Only photos and videos can be uploaded." };
  }
  return { ok: true, fileName: sanitizeFileName(file.name), mimeType };
}

export type Chunk = {
  start: number;
  /** Exclusive. */
  end: number;
  /** Value for the Content-Range request header. */
  contentRange: string;
  isLast: boolean;
};

/** The next piece of the file to send, starting from `offset`. */
export function nextChunk(
  offset: number,
  totalBytes: number,
  chunkSize: number = CHUNK_SIZE,
): Chunk {
  if (offset < 0 || offset >= totalBytes) {
    throw new RangeError("offset is outside the file");
  }
  const end = Math.min(offset + chunkSize, totalBytes);
  return {
    start: offset,
    end,
    contentRange: `bytes ${offset}-${end - 1}/${totalBytes}`,
    isLast: end === totalBytes,
  };
}

/**
 * How many bytes Google has stored so far, from the `Range` header of a
 * "resume incomplete" reply ("bytes=0-8388607" means 8388608 bytes). No header
 * means nothing has been stored yet.
 */
export function bytesReceived(rangeHeader: string | null): number {
  if (!rangeHeader) return 0;
  const match = /^bytes=0-(\d+)$/.exec(rangeHeader.trim());
  return match ? Number(match[1]) + 1 : 0;
}

/**
 * Upload session links are handed to the browser and come back to our server
 * when resuming. Only ever call ones that really point at Google's upload API.
 */
export function isDriveSessionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "www.googleapis.com" &&
      url.pathname === "/upload/drive/v3/files" &&
      url.searchParams.get("uploadType") === "resumable" &&
      Boolean(url.searchParams.get("upload_id"))
    );
  } catch {
    return false;
  }
}

/** "3.4 MB", for progress rows. */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
