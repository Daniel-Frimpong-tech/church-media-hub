import { describe, expect, it } from "vitest";
import {
  bytesReceived,
  checkUpload,
  CHUNK_SIZE,
  formatBytes,
  isDriveSessionUrl,
  MAX_FILE_BYTES,
  nextChunk,
  resolveMimeType,
  sanitizeFileName,
} from "@/lib/domain/uploads";

describe("resolveMimeType", () => {
  it("trusts a photo or video type reported by the browser", () => {
    expect(resolveMimeType("IMG_0001.JPG", "image/jpeg")).toBe("image/jpeg");
    expect(resolveMimeType("clip.mov", "video/quicktime")).toBe("video/quicktime");
  });

  it("falls back to the extension when the phone reports no type", () => {
    expect(resolveMimeType("IMG_0001.HEIC", "")).toBe("image/heic");
    expect(resolveMimeType("DSC_0042.NEF", "")).toBe("image/x-nikon-nef");
    expect(resolveMimeType("sermon.MP4", "application/octet-stream")).toBe("video/mp4");
  });

  it("rejects things that are not photos or videos", () => {
    expect(resolveMimeType("notes.pdf", "application/pdf")).toBeNull();
    expect(resolveMimeType("run.exe", "")).toBeNull();
    expect(resolveMimeType("noextension", "")).toBeNull();
  });
});

describe("sanitizeFileName", () => {
  it("keeps an ordinary name as it is", () => {
    expect(sanitizeFileName("IMG_0001.jpg")).toBe("IMG_0001.jpg");
  });

  it("removes path separators and control characters", () => {
    expect(sanitizeFileName("../../etc/passwd\u0000.jpg")).toBe(".._.._etc_passwd_.jpg");
  });

  it("never returns an empty or dots-only name", () => {
    expect(sanitizeFileName("   ")).toBe("upload");
    expect(sanitizeFileName("..")).toBe("upload");
  });

  it("shortens very long names but keeps the extension", () => {
    const result = sanitizeFileName(`${"a".repeat(300)}.jpeg`);
    expect(result).toHaveLength(200);
    expect(result.endsWith(".jpeg")).toBe(true);
  });
});

describe("checkUpload", () => {
  it("accepts a normal photo", () => {
    expect(checkUpload({ name: "a.jpg", type: "image/jpeg", size: 1000 })).toEqual({
      ok: true,
      fileName: "a.jpg",
      mimeType: "image/jpeg",
    });
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects a size of %s", (size) => {
    expect(checkUpload({ name: "a.jpg", type: "image/jpeg", size }).ok).toBe(false);
  });

  it("rejects files over the limit", () => {
    const result = checkUpload({
      name: "a.mp4",
      type: "video/mp4",
      size: MAX_FILE_BYTES + 1,
    });
    expect(result).toEqual({ ok: false, error: "This file is larger than 20 GB." });
  });

  it("rejects other file types", () => {
    expect(checkUpload({ name: "a.pdf", type: "application/pdf", size: 10 }).ok).toBe(false);
  });
});

describe("nextChunk", () => {
  it("uses a chunk size Google accepts (a multiple of 256 KiB)", () => {
    expect(CHUNK_SIZE % (256 * 1024)).toBe(0);
  });

  it("sends a small file in one final chunk", () => {
    expect(nextChunk(0, 1000)).toEqual({
      start: 0,
      end: 1000,
      contentRange: "bytes 0-999/1000",
      isLast: true,
    });
  });

  it("walks a large file chunk by chunk with no gaps or overlaps", () => {
    const total = CHUNK_SIZE * 2 + 500;
    const first = nextChunk(0, total);
    const second = nextChunk(first.end, total);
    const third = nextChunk(second.end, total);

    expect(first.contentRange).toBe(`bytes 0-${CHUNK_SIZE - 1}/${total}`);
    expect(first.isLast).toBe(false);
    expect(second.start).toBe(first.end);
    expect(third.contentRange).toBe(`bytes ${CHUNK_SIZE * 2}-${total - 1}/${total}`);
    expect(third.isLast).toBe(true);
  });

  it("marks an exactly chunk-sized file as a single last chunk", () => {
    expect(nextChunk(0, CHUNK_SIZE).isLast).toBe(true);
  });

  it("refuses an offset outside the file", () => {
    expect(() => nextChunk(1000, 1000)).toThrow(RangeError);
    expect(() => nextChunk(-1, 1000)).toThrow(RangeError);
  });
});

describe("bytesReceived", () => {
  it("reads how much Google has stored", () => {
    expect(bytesReceived("bytes=0-8388607")).toBe(8388608);
  });

  it("treats a missing or odd header as nothing stored", () => {
    expect(bytesReceived(null)).toBe(0);
    expect(bytesReceived("")).toBe(0);
    expect(bytesReceived("bytes=5-10")).toBe(0);
  });
});

describe("isDriveSessionUrl", () => {
  const good =
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id&upload_id=ABC123";

  it("accepts a real Drive upload session link", () => {
    expect(isDriveSessionUrl(good)).toBe(true);
  });

  it.each([
    "http://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=A",
    "https://evil.example/upload/drive/v3/files?uploadType=resumable&upload_id=A",
    "https://www.googleapis.com.evil.example/upload/drive/v3/files?uploadType=resumable&upload_id=A",
    "https://www.googleapis.com/drive/v3/files?uploadType=resumable&upload_id=A",
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    "http://169.254.169.254/latest/meta-data",
    "not a url",
  ])("rejects %s", (url) => {
    expect(isDriveSessionUrl(url)).toBe(false);
  });
});

describe("formatBytes", () => {
  it.each([
    [512, "512 B"],
    [1536, "1.5 KB"],
    [3_565_158, "3.4 MB"],
    [2 * 1024 ** 3, "2.0 GB"],
    [150 * 1024 ** 2, "150 MB"],
  ])("formats %d as %s", (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});
