/** What the gallery needs to know about one upload. */
export type GalleryItem = {
  id: string;
  fileName: string;
  isVideo: boolean;
  sizeBytes: number;
  /** "Preacher · Sun, Oct 12, 2025" style line shown under the full-size view. */
  caption: string;
  uploadedBy: string | null;
  /** Overrides where the images load from. Only preview pages set this. */
  preview?: { small: string; large: string };
};
