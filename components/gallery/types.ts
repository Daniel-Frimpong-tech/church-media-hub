/** What the gallery needs to know about one upload. */
export type GalleryItem = {
  id: string;
  fileName: string;
  isVideo: boolean;
  sizeBytes: number;
  /** "Preacher · Sun, Oct 12, 2025" style line shown under the full-size view. */
  caption: string;
  uploadedBy: string | null;
  /**
   * Where this item's images and file come from, when not the signed-in
   * routes. Share links set these to their own token-guarded addresses.
   * `download` and `view` are null when the visitor may not have the file.
   */
  urls?: {
    small: string;
    large: string;
    download: string | null;
    view: string | null;
  };
};
