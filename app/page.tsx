import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <Badge tone="accent" className="self-start">
        In development
      </Badge>
      <h1 className="text-display text-ink">RCW Media</h1>
      <p className="text-body text-ink-soft">
        One place for the media team to upload photos and videos from every
        service, see who is covering what, and hand content to the teams that
        need it.
      </p>
      <p className="text-body-sm text-muted">Sign-in is coming next.</p>
    </main>
  );
}
