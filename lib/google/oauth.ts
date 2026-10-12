import "server-only";

import { googleClientId, googleClientSecret, googleTokenUrl } from "@/lib/env";

/**
 * drive.file is the narrowest Drive scope: the app can only see files and
 * folders it created itself, nothing else in the church's Drive.
 */
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const SCOPES = ["openid", "email", DRIVE_FILE_SCOPE];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/** The stored refresh token no longer works. An admin has to reconnect. */
export class GoogleConnectionExpiredError extends Error {
  constructor() {
    super("The church Google account needs to be reconnected.");
    this.name = "GoogleConnectionExpiredError";
  }
}

export function googleRedirectUri(origin: string): string {
  return `${origin}/api/google/callback`;
}

export function buildGoogleAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    // offline + consent makes Google return a refresh token every time, even
    // if this account approved the app before.
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(googleTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      ...body,
    }),
    cache: "no-store",
  });
  return (await response.json()) as TokenResponse;
}

/** Reads the email out of the ID token Google returned directly to us. */
function emailFromIdToken(idToken: string | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (claims && typeof claims === "object" && "email" in claims) {
      return typeof claims.email === "string" ? claims.email : null;
    }
  } catch {
    // Fall through: treated as "no email".
  }
  return null;
}

export type ConnectedAccount = {
  email: string;
  refreshToken: string;
  accessToken: string;
};

/** Finishes the connect flow: swaps Google's one-time code for tokens. */
export async function exchangeCode(
  code: string,
  origin: string,
): Promise<ConnectedAccount> {
  const tokens = await requestToken({
    code,
    redirect_uri: googleRedirectUri(origin),
    grant_type: "authorization_code",
  });

  if (tokens.error || !tokens.access_token) {
    throw new Error(`Google refused the sign-in: ${tokens.error ?? "unknown"}`);
  }
  // Google lets people untick individual permissions on the consent screen.
  if (!tokens.scope?.split(" ").includes(DRIVE_FILE_SCOPE)) {
    throw new Error("drive_permission_missing");
  }
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token");
  }
  const email = emailFromIdToken(tokens.id_token);
  if (!email) throw new Error("Google did not return the account email");

  return {
    email,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
  };
}

export type AccessToken = { token: string; expiresAt: number };

/** Gets a short-lived access token from the long-lived refresh token. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<AccessToken> {
  const tokens = await requestToken({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  // invalid_grant means the token was revoked or has expired for good.
  if (tokens.error === "invalid_grant") throw new GoogleConnectionExpiredError();
  if (tokens.error || !tokens.access_token) {
    throw new Error(`Google token refresh failed: ${tokens.error ?? "unknown"}`);
  }
  return {
    token: tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
  };
}
