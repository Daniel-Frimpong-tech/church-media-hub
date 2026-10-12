import { type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { parseThumbnailSize } from "@/lib/domain/gallery";
import { getDriveSession } from "@/lib/google/connection";
import { getThumbnailLink, sizedThumbnailLink } from "@/lib/google/drive";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uploads/api";

// Google's thumbnail links stay valid for a while. Remembering them briefly
// saves a Drive call when the grid image and the full-size view of the same
// photo are requested close together.
const LINK_TTL_MS = 10 * 60 * 1000;
const LINK_CACHE_MAX = 1000;
const linkCache = new Map<string, { link: string; expiresAt: number }>();

async function thumbnailLinkFor(driveFileId: string): Promise<string | null> {
  const cached = linkCache.get(driveFileId);
  if (cached && cached.expiresAt > Date.now()) return cached.link;

  const { accessToken } = await getDriveSession();
  const link = await getThumbnailLink(accessToken, driveFileId);
  if (link) {
    if (linkCache.size >= LINK_CACHE_MAX) linkCache.clear();
    linkCache.set(driveFileId, { link, expiresAt: Date.now() + LINK_TTL_MS });
  }
  return link;
}

const notFound = () =>
  new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Serves a photo or video preview image. Drive files are private, so the
 * browser cannot load them from Google directly; it asks here, and we check
 * the person may see that upload before fetching the image for them.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/thumb/[uploadId]">,
) {
  const { uploadId } = await params;
  if (!isUuid(uploadId)) return notFound();
  if (!(await getProfile())) return new Response(null, { status: 401 });

  // Queried as the signed-in user: Row Level Security returns nothing for an
  // upload they are not allowed to see, which becomes a 404 here.
  const supabase = await createClient();
  const { data: upload } = await supabase
    .from("uploads")
    .select("drive_file_id")
    .eq("id", uploadId)
    .eq("status", "complete")
    .maybeSingle();
  if (!upload?.drive_file_id) return notFound();

  try {
    const link = await thumbnailLinkFor(upload.drive_file_id);
    // Google takes a little while to make previews for new uploads.
    if (!link) return notFound();

    const size = parseThumbnailSize(request.nextUrl.searchParams.get("size"));
    const image = await fetch(sizedThumbnailLink(link, size), { cache: "no-store" });
    if (!image.ok || !image.body) {
      linkCache.delete(upload.drive_file_id);
      return notFound();
    }

    return new Response(image.body, {
      headers: {
        "Content-Type": image.headers.get("content-type") ?? "image/jpeg",
        // "private": cache in this person's browser only, never on a shared
        // CDN, because who may see an image depends on who is asking.
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("Thumbnail failed", error);
    return new Response(null, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
