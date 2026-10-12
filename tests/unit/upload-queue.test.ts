import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SIZE } from "@/lib/domain/uploads";
import { UploadQueue, type UploadItem } from "@/lib/uploads/queue";

/**
 * The queue talks to two things: our own API (fetch) and Google's upload
 * session (XMLHttpRequest). Both are replaced with scripted fakes here so the
 * resume logic can be tested without a network.
 */

type ChunkReply = { status: number; body?: string } | "network-error";

let chunkReplies: ChunkReply[];
let chunkRanges: string[];
let apiCalls: { url: string; body: Record<string, unknown> }[];
let apiReplies: Record<string, { status: number; body: unknown }[]>;

class FakeXhr {
  status = 0;
  responseText = "";
  upload: { onprogress: ((event: { loaded: number }) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;

  open() {}
  setRequestHeader(name: string, value: string) {
    if (name === "Content-Range") chunkRanges.push(value);
  }
  send(blob: Blob) {
    const reply = chunkReplies.shift();
    queueMicrotask(() => {
      if (!reply || reply === "network-error") {
        this.onerror?.();
        return;
      }
      this.upload.onprogress?.({ loaded: blob.size });
      this.status = reply.status;
      this.responseText = reply.body ?? "";
      this.onload?.();
    });
  }
}

function photo(name: string, bytes: number, type = "image/jpeg"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

async function settle(queue: UploadQueue): Promise<UploadItem[]> {
  // Let retries' back-off timers and all pending promises run.
  for (let i = 0; i < 50 && queue.isBusy; i++) {
    await vi.advanceTimersByTimeAsync(10_000);
  }
  return queue.getSnapshot();
}

const SESSION = {
  status: 200,
  body: { uploadId: "upload-row-1", sessionUrl: "https://session.example/1" },
};
const COMPLETE_OK = { status: 200, body: { ok: true } };

beforeEach(() => {
  vi.useFakeTimers();
  chunkReplies = [];
  chunkRanges = [];
  apiCalls = [];
  apiReplies = {};
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      apiCalls.push({ url, body: JSON.parse(String(init.body)) });
      const reply = apiReplies[url]?.shift();
      if (!reply) throw new TypeError("offline");
      return new Response(JSON.stringify(reply.body), { status: reply.status });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("UploadQueue", () => {
  it("uploads a small file in one request and records it", async () => {
    apiReplies["/api/uploads/session"] = [SESSION];
    apiReplies["/api/uploads/complete"] = [COMPLETE_OK];
    chunkReplies = [{ status: 200, body: '{"id":"drive-file-1"}' }];

    const queue = new UploadQueue("service-1");
    queue.add([photo("a.jpg", 1000)], "category-1");
    const [item] = await settle(queue);

    expect(item.status).toBe("done");
    expect(chunkRanges).toEqual(["bytes 0-999/1000"]);
    expect(apiCalls.map((call) => call.url)).toEqual([
      "/api/uploads/session",
      "/api/uploads/complete",
    ]);
    expect(apiCalls[0].body).toMatchObject({
      serviceId: "service-1",
      categoryId: "category-1",
      fileName: "a.jpg",
      size: 1000,
    });
    expect(apiCalls[1].body).toEqual({
      uploadId: "upload-row-1",
      driveFileId: "drive-file-1",
    });
  });

  it("sends a large file in chunks", async () => {
    const size = CHUNK_SIZE + 500;
    apiReplies["/api/uploads/session"] = [SESSION];
    apiReplies["/api/uploads/complete"] = [COMPLETE_OK];
    chunkReplies = [{ status: 308 }, { status: 201, body: '{"id":"drive-file-1"}' }];

    const queue = new UploadQueue("service-1");
    queue.add([photo("big.mp4", size, "video/mp4")], "category-1");
    const [item] = await settle(queue);

    expect(item.status).toBe("done");
    expect(chunkRanges).toEqual([
      `bytes 0-${CHUNK_SIZE - 1}/${size}`,
      `bytes ${CHUNK_SIZE}-${size - 1}/${size}`,
    ]);
  });

  it("resumes from where Google got to after a dropped connection", async () => {
    const size = CHUNK_SIZE * 2 + 500;
    apiReplies["/api/uploads/session"] = [SESSION];
    // Google only kept part of the first chunk before the drop.
    apiReplies["/api/uploads/status"] = [
      { status: 200, body: { state: "in_progress", received: 262144 } },
    ];
    apiReplies["/api/uploads/complete"] = [COMPLETE_OK];
    chunkReplies = [
      "network-error",
      { status: 308 },
      { status: 200, body: '{"id":"drive-file-1"}' },
    ];

    const queue = new UploadQueue("service-1");
    queue.add([photo("big.mp4", size, "video/mp4")], "category-1");
    const [item] = await settle(queue);

    expect(item.status).toBe("done");
    expect(chunkRanges[1]).toBe(`bytes 262144-${262144 + CHUNK_SIZE - 1}/${size}`);
    // One session only: it carried on rather than starting again.
    expect(apiCalls.filter((c) => c.url === "/api/uploads/session")).toHaveLength(1);
  });

  it("re-checks with Google if the final piece was only partly stored", async () => {
    apiReplies["/api/uploads/session"] = [SESSION];
    apiReplies["/api/uploads/status"] = [
      { status: 200, body: { state: "in_progress", received: 600 } },
    ];
    apiReplies["/api/uploads/complete"] = [COMPLETE_OK];
    chunkReplies = [{ status: 308 }, { status: 200, body: '{"id":"drive-file-1"}' }];

    const queue = new UploadQueue("service-1");
    queue.add([photo("a.jpg", 1000)], "category-1");
    const [item] = await settle(queue);

    expect(item.status).toBe("done");
    expect(chunkRanges).toEqual(["bytes 0-999/1000", "bytes 600-999/1000"]);
  });

  it("finishes without re-sending if Google already has the whole file", async () => {
    apiReplies["/api/uploads/session"] = [SESSION];
    apiReplies["/api/uploads/status"] = [
      { status: 200, body: { state: "complete", fileId: "drive-file-1" } },
    ];
    apiReplies["/api/uploads/complete"] = [COMPLETE_OK];
    // The bytes arrived but the reply was lost.
    chunkReplies = ["network-error"];

    const queue = new UploadQueue("service-1");
    queue.add([photo("a.jpg", 1000)], "category-1");
    const [item] = await settle(queue);

    expect(item.status).toBe("done");
    expect(chunkRanges).toHaveLength(1);
  });

  it("starts a new session if the old one expired", async () => {
    apiReplies["/api/uploads/session"] = [
      SESSION,
      {
        status: 200,
        body: { uploadId: "upload-row-2", sessionUrl: "https://session.example/2" },
      },
    ];
    apiReplies["/api/uploads/status"] = [
      { status: 410, body: { error: { code: "session_gone", message: "expired" } } },
    ];
    apiReplies["/api/uploads/complete"] = [COMPLETE_OK];
    chunkReplies = [{ status: 503 }, { status: 200, body: '{"id":"drive-file-2"}' }];

    const queue = new UploadQueue("service-1");
    queue.add([photo("a.jpg", 1000)], "category-1");
    const [item] = await settle(queue);

    expect(item.status).toBe("done");
    expect(apiCalls.at(-1)?.body).toEqual({
      uploadId: "upload-row-2",
      driveFileId: "drive-file-2",
    });
  });

  it("gives up after repeated failures and can be retried", async () => {
    apiReplies["/api/uploads/session"] = [SESSION];
    chunkReplies = ["network-error", "network-error", "network-error", "network-error"];

    const queue = new UploadQueue("service-1");
    queue.add([photo("a.jpg", 1000)], "category-1");
    let [item] = await settle(queue);

    expect(item.status).toBe("error");
    expect(item.canRetry).toBe(true);

    // Signal is back.
    apiReplies["/api/uploads/complete"] = [COMPLETE_OK];
    chunkReplies = [{ status: 200, body: '{"id":"drive-file-1"}' }];
    queue.retry(item.id);
    [item] = await settle(queue);

    expect(item.status).toBe("done");
    // The retry reused the session it already had.
    expect(apiCalls.filter((c) => c.url === "/api/uploads/session")).toHaveLength(1);
  });

  it("rejects a file that is not a photo or video without calling the server", async () => {
    const queue = new UploadQueue("service-1");
    queue.add([photo("notes.pdf", 1000, "application/pdf")], "category-1");
    const [item] = await settle(queue);

    expect(item).toMatchObject({
      status: "error",
      canRetry: false,
      error: "Only photos and videos can be uploaded.",
    });
    expect(apiCalls).toHaveLength(0);
  });

  it("shows the server's message when Google is disconnected", async () => {
    apiReplies["/api/uploads/session"] = [
      {
        status: 503,
        body: {
          error: {
            code: "google_disconnected",
            message: "The church Google account needs to be reconnected by an admin.",
          },
        },
      },
    ];

    const queue = new UploadQueue("service-1");
    queue.add([photo("a.jpg", 1000)], "category-1");
    const [item] = await settle(queue);

    expect(item.status).toBe("error");
    expect(item.error).toContain("reconnected by an admin");
    expect(item.canRetry).toBe(true);
  });

  it("uploads several files and keeps one failure from stopping the rest", async () => {
    apiReplies["/api/uploads/session"] = [
      SESSION,
      { status: 400, body: { error: { code: "bad_request", message: "This file is empty." } } },
      { status: 200, body: { uploadId: "upload-row-3", sessionUrl: "https://session.example/3" } },
    ];
    apiReplies["/api/uploads/complete"] = [COMPLETE_OK, COMPLETE_OK];
    chunkReplies = [
      { status: 200, body: '{"id":"drive-file-1"}' },
      { status: 200, body: '{"id":"drive-file-3"}' },
    ];

    const queue = new UploadQueue("service-1");
    queue.add(
      [photo("a.jpg", 1000), photo("b.jpg", 1000), photo("c.jpg", 1000)],
      "category-1",
    );
    const items = await settle(queue);

    expect(items.map((item) => item.status).sort()).toEqual(["done", "done", "error"]);
    expect(items.find((item) => item.status === "error")?.canRetry).toBe(false);
  });
});
