import { NextResponse, type NextRequest } from "next/server";
import { isDriveSessionUrl } from "@/lib/domain/uploads";
import { getUploadProgress } from "@/lib/google/drive";
import {
  readJson,
  requireUploader,
  uploadError,
  uploadFailure,
} from "@/lib/uploads/api";

/**
 * After a dropped connection the browser asks here how much of the file Google
 * already has, so it can carry on from that byte instead of starting over.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUploader(request);
  if ("response" in auth) return auth.response;

  const body = await readJson(request);
  const sessionUrl = body?.sessionUrl;
  const size = body?.size;
  // The link comes from the browser, so make sure it really points at Google
  // before this server calls it.
  if (
    typeof sessionUrl !== "string" ||
    !isDriveSessionUrl(sessionUrl) ||
    typeof size !== "number" ||
    !Number.isSafeInteger(size) ||
    size <= 0
  ) {
    return uploadError(400, "bad_request", "Invalid upload session.");
  }

  try {
    const progress = await getUploadProgress(sessionUrl, size);
    if (progress.state === "gone") {
      return uploadError(410, "session_gone", "The upload session expired.");
    }
    return NextResponse.json(progress);
  } catch (error) {
    return uploadFailure(error);
  }
}
