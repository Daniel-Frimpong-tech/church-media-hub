import "server-only";

import type { GalleryItem } from "@/components/gallery/types";
import { isVideo } from "@/lib/domain/uploads";
import { formatChurchDate } from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";

type UploadRow = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  category_id: string;
  uploaded_by: string | null;
  services: { name: string; starts_at: string };
};

/**
 * Turns upload rows into what the gallery grid shows, looking up category and
 * uploader names in two small extra queries.
 */
export async function toGalleryItems(rows: UploadRow[]): Promise<GalleryItem[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();

  const categoryIds = [...new Set(rows.map((row) => row.category_id))];
  const uploaderIds = [
    ...new Set(rows.map((row) => row.uploaded_by).filter((id) => id !== null)),
  ];
  const [categories, uploaders] = await Promise.all([
    supabase.from("categories").select("id, name").in("id", categoryIds),
    uploaderIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", uploaderIds)
      : null,
  ]);
  const categoryName = new Map(
    (categories.data ?? []).map((category) => [category.id, category.name]),
  );
  const uploaderName = new Map(
    (uploaders?.data ?? []).map((person) => [person.id, person.full_name]),
  );

  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    isVideo: isVideo(row.mime_type),
    sizeBytes: row.size_bytes,
    caption: [
      categoryName.get(row.category_id),
      row.services.name,
      formatChurchDate(row.services.starts_at),
    ]
      .filter(Boolean)
      .join(" · "),
    uploadedBy: row.uploaded_by ? (uploaderName.get(row.uploaded_by) ?? null) : null,
  }));
}

export const GALLERY_COLUMNS =
  "id, file_name, mime_type, size_bytes, category_id, uploaded_by, services!inner(name, starts_at)" as const;
