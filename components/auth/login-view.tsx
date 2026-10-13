import { BellRing, FolderCheck, Images, UploadCloud } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

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

const FEATURES = [
  {
    icon: UploadCloud,
    title: "Upload from your phone",
    body: "Pick everything at once. It goes straight to the church Drive.",
  },
  {
    icon: FolderCheck,
    title: "Folders made for you",
    body: "Every service gets its folders, sorted by category.",
  },
  {
    icon: BellRing,
    title: "Nobody chased by hand",
    body: "Reminders and handoffs happen in the team's Telegram.",
  },
  {
    icon: Images,
    title: "Find any photo",
    body: "Search every service by category and date.",
  },
];

// A wall of tiles standing in for an album: photos are private, so the
// sign-in page shows the shape of the gallery, not its contents.
const TILES = [
  "from-[#4b3fa8] to-[#221c52]",
  "from-[#7a3b6b] to-[#2b1530]",
  "from-[#1f5f66] to-[#0f262b]",
  "from-[#8a5a2b] to-[#33200f]",
  "from-[#3a4f9c] to-[#151d3d]",
  "from-[#6b3fa0] to-[#241440]",
  "from-[#2d6b4f] to-[#10261c]",
  "from-[#9c4a4a] to-[#391a1a]",
  "from-[#3f6aa8] to-[#17263d]",
];

export function LoginView({
  errorKey,
  next,
}: {
  errorKey?: string;
  /** Where to return after signing in. */
  next?: string;
}) {
  const message = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <main className="relative flex min-h-dvh flex-1 overflow-hidden">
      {/* Atmosphere: two soft glows of the accent behind everything. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_15%_0%,rgb(157_140_255/0.22),transparent_70%),radial-gradient(50%_45%_at_100%_100%,rgb(157_140_255/0.12),transparent_70%)]"
      />

      <div className="relative mx-auto grid w-full max-w-[1200px] items-center gap-10 px-6 py-12 desktop:grid-cols-[1.05fr_0.95fr] desktop:gap-16 desktop:px-10">
        <div className="stagger flex flex-col gap-8">
          <div className="flex items-center gap-2 text-title text-ink">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-body font-extrabold text-on-primary"
            >
              R
            </span>
            RCW Media
          </div>

          <div className="flex flex-col gap-4">
            <h1 className="text-hero text-ink tablet:text-[3.5rem]">
              Every service,
              <br />
              <span className="text-primary">in one place.</span>
            </h1>
            <p className="max-w-md text-body text-ink-soft">
              Where the media team uploads photos and videos, sees who is
              covering what, and hands content to the teams that need it.
            </p>
          </div>

          {message ? (
            <div role="alert" className="flex max-w-md flex-col gap-1 rounded-lg bg-danger-soft p-4">
              <p className="text-title text-danger">{message.title}</p>
              <p className="text-body-sm text-ink-soft">{message.body}</p>
            </div>
          ) : null}

          <div className="flex max-w-sm flex-col gap-3">
            <GoogleSignInButton next={next} />
            <p className="text-caption text-muted">
              Invite only. Use the Google account an admin invited.
            </p>
          </div>

          <ul className="grid max-w-xl gap-x-6 gap-y-5 tablet:grid-cols-2">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-strong text-primary">
                  <feature.icon aria-hidden size={18} />
                </span>
                <span className="flex flex-col">
                  <span className="text-body-sm font-bold text-ink">{feature.title}</span>
                  <span className="text-caption text-muted">{feature.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* The album wall. Decorative, so hidden from screen readers. */}
        <div aria-hidden className="relative hidden desktop:block">
          <div className="grid rotate-3 grid-cols-3 gap-3">
            {TILES.map((tile, index) => (
              <div
                key={tile}
                style={{ animationDelay: `${index * 70}ms` }}
                className={`aspect-[4/5] animate-rise rounded-lg bg-gradient-to-br shadow-card ${tile} ${
                  index % 3 === 1 ? "translate-y-6" : ""
                }`}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute -inset-16 bg-gradient-to-t from-canvas via-transparent to-canvas/70" />
        </div>
      </div>
    </main>
  );
}
