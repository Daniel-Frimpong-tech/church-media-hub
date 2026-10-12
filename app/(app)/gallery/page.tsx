import type { Metadata } from "next";
import Link from "next/link";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireProfile } from "@/lib/auth";
import {
  dateRangeBounds,
  GALLERY_PAGE_SIZE,
  galleryHref,
  hasFilters,
  parseGalleryFilters,
} from "@/lib/domain/gallery";
import { formatChurchDate } from "@/lib/domain/time";
import { GALLERY_COLUMNS, toGalleryItems } from "@/lib/gallery";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryPage({
  searchParams,
}: PageProps<"/gallery">) {
  await requireProfile();
  const filters = parseGalleryFilters(await searchParams);
  const supabase = await createClient();

  // Ask for one more than a page to know whether there is a next page.
  const offset = (filters.page - 1) * GALLERY_PAGE_SIZE;
  let query = supabase
    .from("uploads")
    .select(GALLERY_COLUMNS)
    .eq("status", "complete")
    .order("completed_at", { ascending: false })
    .range(offset, offset + GALLERY_PAGE_SIZE);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.serviceId) query = query.eq("service_id", filters.serviceId);
  const { startsAtFrom, startsAtBefore } = dateRangeBounds(filters);
  if (startsAtFrom) query = query.gte("services.starts_at", startsAtFrom);
  if (startsAtBefore) query = query.lt("services.starts_at", startsAtBefore);

  const [uploads, categories, services] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase
      .from("services")
      .select("id, name, starts_at")
      .order("starts_at", { ascending: false })
      .limit(100),
  ]);
  if (uploads.error) throw new Error(`Could not load the gallery: ${uploads.error.message}`);

  const hasNextPage = uploads.data.length > GALLERY_PAGE_SIZE;
  const items = await toGalleryItems(uploads.data.slice(0, GALLERY_PAGE_SIZE));
  const filtered = hasFilters(filters);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display text-ink">Gallery</h1>

      <form
        action="/gallery"
        className="grid grid-cols-2 items-end gap-3 rounded-md border border-hairline p-4 tablet:grid-cols-5"
      >
        <div className="col-span-2 tablet:col-span-1">
          <Select
            label="Category"
            name="category"
            defaultValue={filters.categoryId ?? ""}
          >
            <option value="">All categories</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2 tablet:col-span-1">
          <Select
            label="Service"
            name="service"
            defaultValue={filters.serviceId ?? ""}
          >
            <option value="">All services</option>
            {(services.data ?? []).map((service) => (
              <option key={service.id} value={service.id}>
                {formatChurchDate(service.starts_at)} · {service.name}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="From"
          name="from"
          type="date"
          defaultValue={filters.from ?? ""}
          className="h-12"
        />
        <Input
          label="To"
          name="to"
          type="date"
          defaultValue={filters.to ?? ""}
          className="h-12"
        />
        <div className="col-span-2 flex gap-2 tablet:col-span-1">
          <button type="submit" className={buttonClasses("primary", "md", "flex-1")}>
            Search
          </button>
          {filtered ? (
            <Link href="/gallery" className={buttonClasses("ghost", "md")}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {items.length === 0 ? (
        <p className="rounded-md bg-surface-soft p-6 text-body-sm text-muted">
          {filtered
            ? "Nothing matches those filters. Try a wider date range or another category."
            : "No photos or videos yet. They appear here as soon as they are uploaded."}
        </p>
      ) : (
        <GalleryGrid items={items} />
      )}

      {filters.page > 1 || hasNextPage ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          {filters.page > 1 ? (
            <Link
              href={galleryHref(filters, filters.page - 1)}
              className={buttonClasses("secondary")}
            >
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-body-sm text-muted">Page {filters.page}</span>
          {hasNextPage ? (
            <Link
              href={galleryHref(filters, filters.page + 1)}
              className={buttonClasses("secondary")}
            >
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
