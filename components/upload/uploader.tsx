"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/domain/uploads";
import { UploadQueue, type UploadItem } from "@/lib/uploads/queue";

type CategoryOption = { id: string; name: string };

const EMPTY: UploadItem[] = [];

export function Uploader({
  serviceId,
  categories,
  defaultCategoryId,
}: {
  serviceId: string;
  categories: CategoryOption[];
  defaultCategoryId?: string;
}) {
  const router = useRouter();
  const inputId = useId();
  const [queue] = useState(() => new UploadQueue(serviceId));
  const items = useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
    () => EMPTY,
  );
  const [categoryId, setCategoryId] = useState(
    defaultCategoryId ?? categories[0]?.id ?? "",
  );

  const active = items.filter(
    (item) => item.status === "queued" || item.status === "uploading",
  ).length;
  const done = items.filter((item) => item.status === "done").length;
  const failed = items.filter((item) => item.status === "error");
  const retryable = failed.filter((item) => item.canRetry).length;
  const busy = active > 0;

  // Warn before closing the tab while files are still going up.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  // When a batch finishes, refresh the page's upload counts.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) router.refresh();
    wasBusy.current = busy;
  }, [busy, router]);

  function onFilesChosen(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0 && categoryId) queue.add(files, categoryId);
    // Reset so choosing the same file again still fires a change.
    event.target.value = "";
  }

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? "";

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body-sm font-medium text-ink">
          Upload to
        </legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <label
              key={category.id}
              className={cn(
                "flex h-11 cursor-pointer items-center rounded-full border px-4 text-body-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
                category.id === categoryId
                  ? "border-ink bg-ink text-canvas"
                  : "border-hairline bg-canvas text-ink",
              )}
            >
              <input
                type="radio"
                name={`${inputId}-category`}
                value={category.id}
                checked={category.id === categoryId}
                onChange={() => setCategoryId(category.id)}
                className="sr-only"
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <input
          id={inputId}
          type="file"
          multiple
          accept="image/*,video/*,.heic,.heif,.dng,.cr2,.cr3,.nef,.arw,.raf"
          onChange={onFilesChosen}
          className="sr-only"
        />
        <label
          htmlFor={inputId}
          className={buttonClasses(
            "primary",
            "md",
            "w-full cursor-pointer has-focus-visible:outline-2",
          )}
        >
          Choose photos and videos
        </label>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <p className="text-body-sm text-ink-soft">
              {busy
                ? `Uploading. ${done} of ${items.length} done. Keep this page open.`
                : failed.length > 0
                  ? `${done} uploaded, ${failed.length} did not upload.`
                  : `All ${done} uploaded.`}
            </p>
            <div className="flex gap-2">
              {retryable > 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => queue.retryAll()}
                >
                  Retry failed ({retryable})
                </Button>
              ) : null}
              {!busy ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => queue.clearFinished()}
                >
                  Clear list
                </Button>
              ) : null}
            </div>
          </div>

          <ul className="divide-y divide-hairline-soft rounded-md border border-hairline">
            {items.map((item) => (
              <UploadRow
                key={item.id}
                item={item}
                categoryName={categoryName(item.categoryId)}
                onRetry={() => queue.retry(item.id)}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-body-sm text-muted">
          You can pick many files at once. Files go straight to the church
          Google Drive.
        </p>
      )}
    </div>
  );
}

function UploadRow({
  item,
  categoryName,
  onRetry,
}: {
  item: UploadItem;
  categoryName: string;
  onRetry: () => void;
}) {
  const percent =
    item.size > 0 ? Math.floor((item.sentBytes / item.size) * 100) : 0;

  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-body-sm font-medium text-ink">
            {item.fileName}
          </span>
          <span className="text-caption text-muted">
            {categoryName} · {formatBytes(item.size)}
          </span>
        </div>
        {item.status === "done" ? <Badge tone="success">Uploaded</Badge> : null}
        {item.status === "queued" ? <Badge>Waiting</Badge> : null}
        {item.status === "uploading" ? (
          <span className="text-caption font-medium text-ink tabular-nums">
            {percent}%
          </span>
        ) : null}
        {item.status === "error" ? <Badge tone="danger">Failed</Badge> : null}
      </div>

      {item.status === "uploading" ? (
        <div
          role="progressbar"
          aria-label={`Uploading ${item.fileName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 overflow-hidden rounded-full bg-surface-strong"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      {item.status === "error" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="alert" className="text-body-sm text-danger">
            {item.error}
          </p>
          {item.canRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
