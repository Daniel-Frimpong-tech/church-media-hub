import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { GoogleNotConnectedError } from "@/lib/google/connection";
import { GoogleConnectionExpiredError } from "@/lib/google/oauth";
import type { Profile } from "@/lib/supabase/database.types";

/** Error codes the upload screen knows how to explain. */
export type UploadErrorCode =
  | "signed_out"
  | "not_allowed"
  | "bad_request"
  | "folders_not_ready"
  | "google_disconnected"
  | "not_found"
  | "session_gone"
  | "server_error";

export function uploadError(
  status: number,
  code: UploadErrorCode,
  message: string,
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Every upload endpoint starts here: the caller must be signed in, allowed to
 * upload, and calling from our own pages.
 */
export async function requireUploader(
  request: NextRequest,
): Promise<{ profile: Profile } | { response: NextResponse }> {
  // Browsers attach Origin to cross-site POSTs. Refusing foreign origins stops
  // another website from starting uploads with a signed-in person's cookies.
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return {
      response: uploadError(403, "not_allowed", "This request did not come from the app."),
    };
  }

  const profile = await getProfile();
  if (!profile) {
    return {
      response: uploadError(401, "signed_out", "You have been signed out. Sign in and try again."),
    };
  }
  if (!can(profile.role, "upload_media")) {
    return {
      response: uploadError(403, "not_allowed", "Your account cannot upload."),
    };
  }
  return { profile };
}

/** Turns a thrown error into the response the upload screen expects. */
export function uploadFailure(error: unknown): NextResponse {
  if (
    error instanceof GoogleNotConnectedError ||
    error instanceof GoogleConnectionExpiredError
  ) {
    return uploadError(
      503,
      "google_disconnected",
      "The church Google account needs to be reconnected by an admin. Your files are still on your phone.",
    );
  }
  console.error("Upload request failed", error);
  return uploadError(502, "server_error", "Something went wrong. Try again.");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
