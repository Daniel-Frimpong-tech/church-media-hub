import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { formatChurchDate } from "@/lib/domain/time";
import { getGoogleConnectionSummary } from "@/lib/google/connection";
import { driveFolderUrl } from "@/lib/google/links";

export const metadata: Metadata = { title: "Google Drive" };

const ERRORS: Record<string, string> = {
  cancelled: "Google sign-in was cancelled. Nothing was changed.",
  invalid_state:
    "That sign-in attempt expired or did not start here. Nothing was changed. Try again.",
  drive_permission_missing:
    "The Google Drive permission was not ticked on Google's screen, so the app cannot store files. Try again and leave the Drive box ticked.",
  failed: "Could not connect to Google. Nothing was changed. Try again.",
};

export default async function GooglePage({
  searchParams,
}: PageProps<"/admin/google">) {
  await requireAdmin();
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : null;
  const justConnected = params.connected === "1";
  const connection = await getGoogleConnectionSummary();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display text-ink">Google Drive</h1>
        <p className="text-body text-ink-soft">
          Every photo and video is stored in one church Google account, so it
          counts against the church&apos;s storage and not a volunteer&apos;s.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft p-4 text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      {justConnected && connection ? (
        <p role="status" className="rounded-md bg-success-soft p-4 text-body-sm text-success">
          Connected to {connection.accountEmail}.
        </p>
      ) : null}

      <Card className="flex flex-col gap-4">
        {connection ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-title text-ink break-all">
                {connection.accountEmail}
              </h2>
              {connection.status === "connected" ? (
                <Badge tone="success">Connected</Badge>
              ) : (
                <Badge tone="danger">Needs reconnecting</Badge>
              )}
            </div>
            {connection.status === "expired" ? (
              <p className="text-body-sm text-danger">
                Google stopped accepting the saved sign-in. Uploads and new
                service folders will fail until an admin reconnects.
              </p>
            ) : (
              <p className="text-body-sm text-muted">
                Connected {formatChurchDate(connection.connectedAt)}. Files go
                into the &ldquo;RCW Media&rdquo; folder in this account.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <a
                href="/api/google/connect"
                className={buttonClasses(
                  connection.status === "expired" ? "primary" : "secondary",
                )}
              >
                Reconnect
              </a>
              <a
                href={driveFolderUrl(connection.rootFolderId)}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses("ghost")}
              >
                Open folder in Drive
              </a>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-title text-ink">Not connected yet</h2>
            <p className="text-body-sm text-muted">
              Sign in with the church Google account, not your personal one.
              The app can only see the files and folders it creates itself.
            </p>
            <a
              href="/api/google/connect"
              className={buttonClasses("primary", "md", "self-start")}
            >
              Connect church Google account
            </a>
          </>
        )}
      </Card>
    </div>
  );
}
