import { describe, expect, it } from "vitest";
import { countFiles, summarizeUploads } from "@/lib/domain/upload-summary";

const photo = (uploadedBy: string | null, categoryId: string, completedAt: string) => ({
  uploadedBy,
  categoryId,
  mimeType: "image/jpeg",
  completedAt,
});

describe("who uploaded what", () => {
  it("gives one line per person and category, in the order they started", () => {
    const lines = summarizeUploads([
      photo("peter", "preacher", "2026-10-12T18:05:00Z"),
      photo("daniel", "baptism", "2026-10-12T18:01:00Z"),
      photo("daniel", "baptism", "2026-10-12T18:09:00Z"),
      { ...photo("daniel", "baptism", "2026-10-12T18:10:00Z"), mimeType: "video/mp4" },
      photo("daniel", "preacher", "2026-10-12T18:20:00Z"),
    ]);
    expect(lines).toEqual([
      { uploadedBy: "daniel", categoryId: "baptism", photos: 2, videos: 1 },
      { uploadedBy: "peter", categoryId: "preacher", photos: 1, videos: 0 },
      { uploadedBy: "daniel", categoryId: "preacher", photos: 1, videos: 0 },
    ]);
  });

  it("keeps uploads by people who were removed together", () => {
    const lines = summarizeUploads([
      photo(null, "baptism", "2026-10-12T18:01:00Z"),
      photo(null, "baptism", "2026-10-12T18:02:00Z"),
    ]);
    expect(lines).toEqual([{ uploadedBy: null, categoryId: "baptism", photos: 2, videos: 0 }]);
  });

  it("is empty with no uploads", () => {
    expect(summarizeUploads([])).toEqual([]);
  });
});

describe("counting files", () => {
  it("names photos and videos, singular and plural", () => {
    expect(countFiles(24, 0)).toBe("24 photos");
    expect(countFiles(1, 0)).toBe("1 photo");
    expect(countFiles(0, 1)).toBe("1 video");
    expect(countFiles(24, 2)).toBe("24 photos and 2 videos");
  });
});
