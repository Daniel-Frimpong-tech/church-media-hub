import "server-only";

import { tokenEncryptionKey } from "@/lib/env";
import type { GoogleConnectionStatus } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "./crypto";
import { createFolder, folderExists } from "./drive";
import {
  GoogleConnectionExpiredError,
  refreshAccessToken,
  type AccessToken,
  type ConnectedAccount,
} from "./oauth";

const ROOT_FOLDER_NAME = "RCW Media";

/** The church account is not connected yet. An admin has to connect it. */
export class GoogleNotConnectedError extends Error {
  constructor() {
    super("The church Google account has not been connected yet.");
    this.name = "GoogleNotConnectedError";
  }
}

/** What is safe to show an admin. Never includes the token. */
export type GoogleConnectionSummary = {
  accountEmail: string;
  status: GoogleConnectionStatus;
  rootFolderId: string;
  connectedAt: string;
};

export async function getGoogleConnectionSummary(): Promise<GoogleConnectionSummary | null> {
  const { data, error } = await createAdminClient()
    .from("google_connection")
    .select("account_email, status, root_folder_id, connected_at")
    .maybeSingle();
  if (error) throw new Error(`Could not read Google connection: ${error.message}`);
  if (!data) return null;
  return {
    accountEmail: data.account_email,
    status: data.status,
    rootFolderId: data.root_folder_id,
    connectedAt: data.connected_at,
  };
}

/**
 * Saves a newly connected account. Reconnecting the same account keeps the
 * existing "RCW Media" folder; a different account gets a new one.
 */
export async function saveGoogleConnection(
  account: ConnectedAccount,
  connectedBy: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("google_connection")
    .select("account_email, root_folder_id")
    .maybeSingle();

  let rootFolderId: string | null = null;
  if (
    existing &&
    existing.account_email.toLowerCase() === account.email.toLowerCase() &&
    (await folderExists(account.accessToken, existing.root_folder_id))
  ) {
    rootFolderId = existing.root_folder_id;
  }
  rootFolderId ??= await createFolder(account.accessToken, ROOT_FOLDER_NAME);

  const { error } = await admin.from("google_connection").upsert({
    id: true,
    account_email: account.email,
    refresh_token_encrypted: encryptSecret(
      account.refreshToken,
      tokenEncryptionKey(),
    ),
    root_folder_id: rootFolderId,
    status: "connected",
    last_error: null,
    connected_by: connectedBy,
    connected_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not save Google connection: ${error.message}`);
  cachedToken = null;
}

// Access tokens last about an hour. Reusing one within a server instance
// avoids a round trip to Google on every Drive call.
let cachedToken: AccessToken | null = null;
const EXPIRY_MARGIN_MS = 60_000;

export type DriveSession = { accessToken: string; rootFolderId: string };

/**
 * An access token for the church account plus the root folder to work in.
 * Throws GoogleNotConnectedError or GoogleConnectionExpiredError, which the UI
 * turns into a "connect" or "reconnect" prompt.
 */
export async function getDriveSession(): Promise<DriveSession> {
  const admin = createAdminClient();
  const { data: connection, error } = await admin
    .from("google_connection")
    .select("refresh_token_encrypted, root_folder_id, status")
    .maybeSingle();
  if (error) throw new Error(`Could not read Google connection: ${error.message}`);
  if (!connection) throw new GoogleNotConnectedError();

  if (cachedToken && cachedToken.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return {
      accessToken: cachedToken.token,
      rootFolderId: connection.root_folder_id,
    };
  }

  try {
    cachedToken = await refreshAccessToken(
      decryptSecret(connection.refresh_token_encrypted, tokenEncryptionKey()),
    );
  } catch (refreshError) {
    if (refreshError instanceof GoogleConnectionExpiredError) {
      await markGoogleConnectionExpired("Google rejected the saved sign-in.");
    }
    throw refreshError;
  }

  return {
    accessToken: cachedToken.token,
    rootFolderId: connection.root_folder_id,
  };
}

/** Records that the connection stopped working so every admin sees it. */
export async function markGoogleConnectionExpired(reason: string): Promise<void> {
  cachedToken = null;
  await createAdminClient()
    .from("google_connection")
    .update({ status: "expired", last_error: reason })
    .eq("id", true);
}
