"use client";

import { Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteUpload } from "@/app/(app)/services/actions";
import { ActionButton } from "@/components/ui/action-button";
import { buttonClasses } from "@/components/ui/button";
import { DIRECT_DOWNLOAD_MAX_BYTES } from "@/lib/domain/gallery";
import { formatBytes } from "@/lib/domain/uploads";
import type { GalleryItem } from "./types";

const thumbUrl = (item: GalleryItem, size: 400 | 1600) =>
  item.urls
    ? size === 400
      ? item.urls.small
      : item.urls.large
    : `/api/thumb/${item.id}?size=${size}`;
const downloadUrl = (item: GalleryItem) =>
  item.urls ? item.urls.download : `/api/files/${item.id}`;
const viewUrl = (item: GalleryItem) =>
  item.urls ? item.urls.view : `/api/files/${item.id}?as=view`;

/** A photo-album grid. Tap a tile to see it full size, swipe or use arrows to move. */
export function GalleryGrid({
  items,
  canDelete = false,
  shared = false,
}: {
  items: GalleryItem[];
  /** Admins get a Delete button in the full-size view. */
  canDelete?: boolean;
  /** True on a share link, where the visitor has no account. */
  shared?: boolean;
}) {
  const [requestedIndex, setOpenIndex] = useState<number | null>(null);
  // After a delete the list is shorter. If the open position no longer exists
  // (it was the last one), close the viewer.
  const openIndex =
    requestedIndex !== null && requestedIndex < items.length ? requestedIndex : null;

  return (
    <>
      <ul className="grid grid-cols-3 gap-1.5 tablet:grid-cols-4 tablet:gap-2 desktop:grid-cols-5">
        {items.map((item, index) => (
          <li key={item.id}>
            <Tile item={item} onOpen={() => setOpenIndex(index)} />
          </li>
        ))}
      </ul>
      {openIndex !== null ? (
        <Lightbox
          items={items}
          index={openIndex}
          onChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          canDelete={canDelete}
          shared={shared}
        />
      ) : null}
    </>
  );
}

function Tile({ item, onOpen }: { item: GalleryItem; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${item.fileName}`}
      className="group relative block aspect-square w-full overflow-hidden rounded-sm bg-surface-strong tablet:rounded-md"
    >
      {failed ? (
        <span className="flex h-full items-center justify-center p-2 text-center text-caption break-all text-muted">
          {item.fileName}
        </span>
      ) : (
        // A plain <img>: these come from our own authenticated route, and
        // next/image would spend the free image-optimisation allowance.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl(item, 400)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      {item.isVideo ? (
        <span className="absolute right-1.5 bottom-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white">
          <Play aria-hidden size={14} fill="currentColor" />
          <span className="sr-only">Video</span>
        </span>
      ) : null}
    </button>
  );
}

function Lightbox({
  items,
  index,
  onChange,
  onClose,
  canDelete,
  shared,
}: {
  items: GalleryItem[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
  canDelete: boolean;
  shared: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStartX = useRef<number | null>(null);
  const item = items[index];
  const hasPrevious = index > 0;
  const hasNext = index < items.length - 1;

  const go = useCallback(
    (step: -1 | 1) => {
      const next = index + step;
      if (next >= 0 && next < items.length) onChange(next);
    },
    [index, items.length, onChange],
  );

  // showModal() gives focus trapping, Escape to close and a backdrop for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const opensInDrive = item.sizeBytes > DIRECT_DOWNLOAD_MAX_BYTES;
  const download = downloadUrl(item);
  const view = viewUrl(item);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={item.fileName}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-black p-0 text-white backdrop:bg-black"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 p-3">
          <span className="text-body-sm tabular-nums">
            {index + 1} of {items.length}
          </span>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="flex h-11 items-center rounded-full bg-white/15 px-4 text-body-sm font-medium"
          >
            Close
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStartX.current;
            const end = event.changedTouches[0]?.clientX;
            touchStartX.current = null;
            if (start === null || end === undefined) return;
            if (end - start > 60) go(-1);
            if (start - end > 60) go(1);
          }}
        >
          <LightboxImage key={item.id} item={item} />

          {hasPrevious ? (
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous"
              className="absolute left-2 hidden h-11 w-11 items-center justify-center rounded-full bg-white/15 text-title-lg tablet:flex"
            >
              ‹
            </button>
          ) : null}
          {hasNext ? (
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next"
              className="absolute right-2 hidden h-11 w-11 items-center justify-center rounded-full bg-white/15 text-title-lg tablet:flex"
            >
              ›
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-body-sm font-medium">
              {item.fileName}
            </span>
            <span className="text-caption text-white/70">
              {item.caption}
              {item.uploadedBy ? ` · ${item.uploadedBy}` : ""} ·{" "}
              {formatBytes(item.sizeBytes)}
            </span>
          </div>
          {download || (item.isVideo && view) ? (
            <div className="flex flex-wrap gap-2 tablet:max-w-md">
              {item.isVideo && view ? (
                <a
                  href={view}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClasses("primary", "md", "flex-1")}
                >
                  Play in Google Drive
                </a>
              ) : null}
              {download ? (
                <a
                  href={download}
                  {...(opensInDrive
                    ? { target: "_blank", rel: "noreferrer" }
                    : { download: item.fileName })}
                  className={
                    item.isVideo && view
                      ? "flex h-12 flex-1 items-center justify-center rounded-full border border-white/40 px-6 text-body-sm font-bold"
                      : buttonClasses("primary", "md", "flex-1")
                  }
                >
                  {opensInDrive ? "Download from Drive" : "Download"}
                </a>
              ) : null}
            </div>
          ) : null}
          {(item.isVideo && view) || (download && opensInDrive) ? (
            <p className="text-caption text-white/70">
              {shared
                ? "Opens in Google Drive."
                : "Opens in Google Drive. Use the same Google account you sign in here with."}
            </p>
          ) : null}
          {canDelete ? (
            // Keyed by file so a message about one file never shows on the next.
            <ActionButton
              key={item.id}
              action={deleteUpload}
              fields={{ upload_id: item.id }}
              label="Delete this file"
              pendingLabel="Deleting…"
              variant="danger"
              className="self-start"
              confirmMessage={`Delete ${item.fileName}? It moves to the Google Drive bin, where it can be restored for 30 days.`}
            />
          ) : null}
        </div>
      </div>
    </dialog>
  );
}

function LightboxImage({ item }: { item: GalleryItem }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <p className="px-6 text-center text-body-sm text-white/70">
        No preview yet. Google is still preparing it, or this file type has
        none. You can still download it.
      </p>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbUrl(item, 1600)}
      alt={item.fileName}
      onError={() => setFailed(true)}
      className="max-h-full max-w-full object-contain"
    />
  );
}
