import { checkUpload, nextChunk } from "@/lib/domain/uploads";

/**
 * Browser-side upload queue. It lives outside React so that uploads keep
 * running however the screen re-renders; the Uploader component subscribes to
 * it and just draws what it reports.
 */

export type UploadItemStatus = "queued" | "uploading" | "done" | "error";

export type UploadItem = {
  id: string;
  fileName: string;
  size: number;
  categoryId: string;
  status: UploadItemStatus;
  /** Bytes Google has confirmed, plus progress on the chunk being sent. */
  sentBytes: number;
  error?: string;
  /** False when trying again cannot help, e.g. the file is not a photo. */
  canRetry: boolean;
};

type Job = {
  file: File;
  mimeType: string;
  uploadId?: string;
  sessionUrl?: string;
  /** Bytes Google has confirmed. */
  offset: number;
};

const MAX_PARALLEL = 2;
const MAX_ATTEMPTS = 4;

class UploadFailure extends Error {
  constructor(
    message: string,
    readonly canRetry: boolean,
  ) {
    super(message);
  }
}

type ApiError = { error?: { code?: string; message?: string } };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new UploadFailure("No connection. Check your signal and try again.", true);
  }
  const data = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    const code = data.error?.code;
    // Retrying will not fix these until someone acts.
    const canRetry = code !== "bad_request" && code !== "not_allowed";
    const failure = new UploadFailure(
      data.error?.message ?? "Something went wrong. Try again.",
      canRetry,
    );
    (failure as UploadFailure & { code?: string }).code = code;
    throw failure;
  }
  return data;
}

type ChunkResult = { status: number; body: string };

/** Sends one piece of the file to Google, reporting progress as it goes. */
function sendChunk(
  sessionUrl: string,
  blob: Blob,
  contentRange: string,
  onProgress: (loaded: number) => void,
): Promise<ChunkResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sessionUrl);
    xhr.setRequestHeader("Content-Range", contentRange);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.send(blob);
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class UploadQueue {
  private items: UploadItem[] = [];
  private jobs = new Map<string, Job>();
  private listeners = new Set<() => void>();
  private running = 0;
  private nextId = 1;

  constructor(private readonly serviceId: string) {}

  // ── For useSyncExternalStore ──────────────────────────────────────────────

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): UploadItem[] => this.items;

  // ── Actions ───────────────────────────────────────────────────────────────

  add(files: File[], categoryId: string): void {
    const added: UploadItem[] = files.map((file) => {
      const id = `upload-${this.nextId++}`;
      const check = checkUpload(file);
      if (!check.ok) {
        return {
          id,
          fileName: file.name,
          size: file.size,
          categoryId,
          status: "error",
          sentBytes: 0,
          error: check.error,
          canRetry: false,
        };
      }
      this.jobs.set(id, { file, mimeType: check.mimeType, offset: 0 });
      return {
        id,
        fileName: check.fileName,
        size: file.size,
        categoryId,
        status: "queued",
        sentBytes: 0,
        canRetry: true,
      };
    });
    this.items = [...this.items, ...added];
    this.emit();
    this.pump();
  }

  retry(id: string): void {
    const item = this.items.find((entry) => entry.id === id);
    if (!item || item.status !== "error" || !item.canRetry) return;
    this.update(id, { status: "queued", error: undefined });
    this.pump();
  }

  retryAll(): void {
    for (const item of this.items) {
      if (item.status === "error" && item.canRetry) this.retry(item.id);
    }
  }

  /** Removes finished and failed rows from the list. */
  clearFinished(): void {
    for (const item of this.items) {
      if (item.status === "done" || item.status === "error") {
        this.jobs.delete(item.id);
      }
    }
    this.items = this.items.filter(
      (item) => item.status === "queued" || item.status === "uploading",
    );
    this.emit();
  }

  get isBusy(): boolean {
    return this.items.some(
      (item) => item.status === "queued" || item.status === "uploading",
    );
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private update(id: string, patch: Partial<UploadItem>): void {
    this.items = this.items.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    this.emit();
  }

  private pump(): void {
    while (this.running < MAX_PARALLEL) {
      const next = this.items.find((item) => item.status === "queued");
      if (!next) return;
      this.running += 1;
      this.update(next.id, { status: "uploading" });
      void this.run(next).finally(() => {
        this.running -= 1;
        this.pump();
      });
    }
  }

  private async run(item: UploadItem): Promise<void> {
    const job = this.jobs.get(item.id);
    if (!job) return;

    try {
      const fileId = await this.sendFile(item, job);
      await postJson("/api/uploads/complete", {
        uploadId: job.uploadId,
        driveFileId: fileId,
      });
      this.jobs.delete(item.id);
      this.update(item.id, { status: "done", sentBytes: item.size });
    } catch (error) {
      const failure =
        error instanceof UploadFailure
          ? error
          : new UploadFailure("Upload interrupted. Try again.", true);
      this.update(item.id, {
        status: "error",
        error: failure.message,
        canRetry: failure.canRetry,
      });
    }
  }

  /** Sends the whole file, resuming after hiccups. Returns the Drive file ID. */
  private async sendFile(item: UploadItem, job: Job): Promise<string> {
    let attempts = 0;

    while (true) {
      if (!job.sessionUrl) {
        const session = await postJson<{ uploadId: string; sessionUrl: string }>(
          "/api/uploads/session",
          {
            serviceId: this.serviceId,
            categoryId: item.categoryId,
            fileName: job.file.name,
            mimeType: job.mimeType,
            size: job.file.size,
          },
        );
        job.uploadId = session.uploadId;
        job.sessionUrl = session.sessionUrl;
        job.offset = 0;
        this.update(item.id, { sentBytes: 0 });
      }

      const chunk = nextChunk(job.offset, job.file.size);
      let result: ChunkResult | null = null;
      try {
        result = await sendChunk(
          job.sessionUrl,
          job.file.slice(chunk.start, chunk.end),
          chunk.contentRange,
          (loaded) =>
            this.update(item.id, {
              sentBytes: Math.min(chunk.start + loaded, job.file.size),
            }),
        );
      } catch {
        // Connection dropped mid-chunk. Handled below like a server error.
      }

      if (result && (result.status === 200 || result.status === 201)) {
        const { id } = JSON.parse(result.body) as { id?: string };
        if (!id) throw new UploadFailure("Google did not confirm the file.", true);
        return id;
      }
      // 308 is Google's "got that piece, send the next one".
      if (result && result.status === 308 && !chunk.isLast) {
        job.offset = chunk.end;
        attempts = 0;
        this.update(item.id, { sentBytes: job.offset });
        continue;
      }

      // Anything else, including a 308 on the final piece (Google kept less
      // than we sent): ask how much Google really has, then carry on from there.
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        throw new UploadFailure(
          "Upload interrupted. Check your signal and try again.",
          true,
        );
      }
      // No need to wait if Google answered; back off if the network failed.
      if (!result || result.status !== 308) {
        await wait(1000 * 2 ** (attempts - 1));
      }

      try {
        const progress = await postJson<
          | { state: "in_progress"; received: number }
          | { state: "complete"; fileId: string }
        >("/api/uploads/status", {
          sessionUrl: job.sessionUrl,
          size: job.file.size,
        });
        if (progress.state === "complete") return progress.fileId;
        job.offset = progress.received;
        this.update(item.id, { sentBytes: job.offset });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "session_gone") {
          // The session expired: start this file again with a new one.
          job.sessionUrl = undefined;
          job.uploadId = undefined;
        } else if (error instanceof UploadFailure && !error.canRetry) {
          throw error;
        }
        // Otherwise still offline: loop round and try the chunk again.
      }
    }
  }
}
