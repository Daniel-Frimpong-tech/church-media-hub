import type { Metadata } from "next";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, { title: string; body: string }> = {
  not_invited: {
    title: "That Google account has not been invited",
    body: "Ask a media team admin to invite the email address you signed in with, then try again.",
  },
  no_access: {
    title: "Your access has been turned off",
    body: "Ask a media team admin if you think this is a mistake.",
  },
  sign_in_failed: {
    title: "Sign-in did not finish",
    body: "Nothing was changed. Try again.",
  },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-display text-ink">RCW Media</h1>
        <p className="text-body text-ink-soft">
          Photos and videos from every service, in one place.
        </p>
      </div>

      {message ? (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-md bg-danger-soft p-4"
        >
          <p className="text-title text-danger">{message.title}</p>
          <p className="text-body-sm text-ink-soft">{message.body}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <GoogleSignInButton next={typeof next === "string" ? next : undefined} />
        <p className="text-body-sm text-muted">
          Invite only. Use the Google account an admin invited.
        </p>
      </div>
    </main>
  );
}
