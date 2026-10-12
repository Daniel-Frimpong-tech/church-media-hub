import "server-only";

import { GoogleConnectionExpiredError } from "./oauth";

const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DriveError";
  }
}

async function driveFetch(
  accessToken: string,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (response.status === 401) throw new GoogleConnectionExpiredError();
  if (!response.ok) {
    const detail = await response.text();
    throw new DriveError(
      `Google Drive returned ${response.status}: ${detail.slice(0, 300)}`,
      response.status,
    );
  }
  return response;
}

/** Creates a folder and returns its Drive file ID. */
export async function createFolder(
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const response = await driveFetch(accessToken, `${FILES_URL}?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME_TYPE,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  const { id } = (await response.json()) as { id: string };
  return id;
}

/** True if the folder still exists, is not in the bin, and we can see it. */
export async function folderExists(
  accessToken: string,
  folderId: string,
): Promise<boolean> {
  try {
    const response = await driveFetch(
      accessToken,
      `${FILES_URL}/${encodeURIComponent(folderId)}?fields=id,trashed`,
      { method: "GET" },
    );
    const { trashed } = (await response.json()) as { trashed?: boolean };
    return !trashed;
  } catch (error) {
    if (error instanceof DriveError && error.status === 404) return false;
    throw error;
  }
}
