import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { requireProfile } from "@/lib/auth";
import { formatChurchDate } from "@/lib/domain/time";
import { GALLERY_COLUMNS, toGalleryItems } from "@/lib/gallery";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uploads/api";

export const metadata: Metadata = { title: "Album" };

// An album shows everything for one service and category. A single service
// rarely has more than a few hundred files per category.
const ALBUM_LIMIT = 1000;

export default async function AlbumPage({
  params,
}: PageProps<"/services/[id]/[category]">) {
  await requireProfile();
  const { id, category: slug } = await params;
  if (!isUuid(id) || !/^[a-z0-9-]{1,60}$/.test(slug)) notFound();

  const supabase = await createClient();
  const [service, category] = await Promise.all([
    supabase.from("services").select("id, name, starts_at").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").eq("slug", slug).maybeSingle(),
  ]);
  if (!service.data || !category.data) notFound();

  // Row Level Security returns no rows for a category this person cannot see.
  const uploads = await supabase
    .from("uploads")
    .select(GALLERY_COLUMNS)
    .eq("service_id", id)
    .eq("category_id", category.data.id)
    .eq("status", "complete")
    .order("completed_at", { ascending: false })
    .limit(ALBUM_LIMIT);
  if (uploads.error) throw new Error(`Could not load the album: ${uploads.error.message}`);

  const items = await toGalleryItems(uploads.data);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/services/${id}`} className="text-body-sm text-muted underline">
          {service.data.name}
        </Link>
        <h1 className="text-display text-ink">{category.data.name}</h1>
        <p className="text-body text-ink-soft">
          {formatChurchDate(service.data.starts_at)} · {items.length}{" "}
          {items.length === 1 ? "file" : "files"}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md bg-surface-soft p-6 text-body-sm text-muted">
          Nothing here yet. Files appear as soon as they finish uploading.
        </p>
      ) : (
        <GalleryGrid items={items} />
      )}
    </div>
  );
}
