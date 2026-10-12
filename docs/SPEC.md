# Build the Church Media Hub

You are building a web app for my church's media team. The repo already exists with a fresh Next.js setup deployed on Vercel. I need a working v1 the team can use soon, built to a standard I'd proudly show in a job interview.

Repo is github.com/Daniel-Frimpong-tech/church-media-hub
Live site is church-media-hub-khaki.vercel.app

## Who uses it and why

The media team covers every church service. For each one they currently make 4 Google Photos albums by hand (baptism, preacher, fellowship, videos) so each downstream team gets only what it needs. The thumbnail team, for example, only needs preacher photos. The team talks in a Telegram group chat.

Their pain points, in their words

- Creating 4 new albums every service is tedious
- People forget to upload
- Nobody knows who uploaded what or when
- Nobody knows who is responsible for what at a given service
- Downstream teams (like thumbnails) don't always get content on time

We are moving from Google Photos to Google Drive folders, because the Photos API no longer allows sharing albums or reading content the app didn't upload.

## Stack and constraints

- Next.js (App Router) + TypeScript + Tailwind, already in the repo. This is a newer Next.js version. Read `AGENTS.md` and the docs in `node_modules/next/dist/docs/` before writing code, and follow current conventions.
- Supabase for Postgres and auth (free tier)
- Vercel Hobby for hosting (free tier)
- Google Drive API for files, stored in the church's Google account (1 TB plan)
- Telegram Bot API for group messages
- Cost must stay at $0. If anything you propose costs money, stop and tell me first.
- Times are America/Los_Angeles

## Version 1 features

### 1. Sign-in and roles

- Google sign-in through Supabase Auth
- Invite only. An admin adds someone's email before they can get in.
- Roles are `admin`, `member`, and `viewer`. Admins manage services, people, categories, and teams. Members upload and mark tasks done. Viewers (downstream teams) see and download only the categories assigned to their team.
- Enforce permissions with Supabase Row Level Security, not just in the UI

### 2. Services

- Admin creates a service with a name, date, and time (for example "Sunday Service, Oct 12")
- Support recurring services (for example every Sunday at 10am) so they're created automatically
- Creating a service automatically creates a Drive folder for it, with one subfolder per category

### 3. Categories and receiving teams

- Categories live in a database table, not hardcoded. Seed them with baptism, preacher, fellowship, and videos.
- Each category maps to one or more receiving teams (for example preacher goes to the thumbnail team)
- Each mapping has a delivery deadline relative to the service (for example within 24 hours)

### 4. Assignments

- For each service, an admin assigns people to roles (for example photographer, videographer, editor)
- Each assignment says which categories that person is expected to upload
- A dashboard shows every upcoming service, who is assigned, and what's still missing

### 5. Uploads

- Members upload photos and videos through the app, not straight to Drive
- Files must be owned by the church Google account so they count against its 1 TB, not the volunteer's personal storage
- Photos and videos are too large for Vercel request limits. Use Drive resumable uploads. The server starts the upload session with the church account's token, then the browser uploads the file directly to Google. Pass the browser's Origin when starting the session so CORS works.
- Support selecting many files at once from a phone, with progress for each file and retry on failure
- Every upload is recorded in Postgres with who uploaded it, when, which service, which category, and the Drive file ID

### 6. Gallery and search

- A gallery page per service and category that looks like a photo album (thumbnail grid, tap to view full size, download)
- Search and filter by category, service, and date range (for example "baptism, May 2025")
- Drive thumbnail links need auth, so serve them through an API route with caching

### 7. Handoffs

- Receiving teams see what's ready for them and can mark a delivery as received
- The dashboard shows each handoff as pending, delivered, or late, based on the deadline

### 8. Telegram bot

- Webhook route in the app. Verify Telegram's secret token header on every request.
- Admin links the team group chat to the app once
- People link their Telegram account by sending `/join` to the bot, which replies with a one-time link that connects their Telegram ID to their app account
- When a service's folders are created, post a message to the group with a link to the service page in the app
- Reminders after a service tag only the assigned people who haven't uploaded their categories yet. Use Telegram's HTML mention format so people without a username still get tagged.
- Notify a receiving team when their category is ready, and flag late handoffs

### 9. Scheduled jobs

- Needed for creating recurring services and sending reminders
- Vercel Hobby cron may be too limited. Check its current limits and pick the free option that fits (Vercel cron, Supabase pg_cron, or a GitHub Actions schedule). Explain the choice.

## Google setup details

- One-time admin flow to connect the church Google account. Store its refresh token server-side only, encrypted.
- Use the narrowest Drive scope that works. I think `drive.file` is enough since the app creates every folder and file, but confirm it.
- Make sure the OAuth app is set up so refresh tokens don't expire after 7 days (apps left in Testing mode have this problem). Tell me exactly what I need to click in Google Cloud Console.

## Out of scope for now

Leave these out, but design the schema so they're easy to add later.

- Social media posting calendar
- AI caption drafts and AI photo tagging
- Importing the old Google Photos albums (will be a separate script using a Google Takeout export)

## Quality bar

- TypeScript strict mode, no `any` unless justified in a comment
- Database schema in versioned Supabase migrations, plus a seed script with realistic sample data
- Unit tests (Vitest) for permission rules, deadline and late logic, and reminder targeting
- One Playwright test for the main flow (create service, upload, see it in the gallery)
- GitHub Actions CI running lint, typecheck, and tests on every push
- Clear error states in the UI, especially for failed uploads and an expired Google connection
- Mobile first. Most uploads will come from phones right after service.
- No secrets in the repo. Provide `.env.example` with every variable explained.

## How I want you to work

1. Start by reading the repo, then give me a plan with the schema, folder structure, and build order. Wait for my OK before writing code.
2. Build in phases. Suggested order is auth and roles, then services and Drive folders, then uploads, then gallery, then assignments and handoffs, then Telegram, then scheduled jobs.
3. Commit after each working step with a clear message. Make sure the Vercel build passes at the end of each phase.
4. Ask me before any big decision that's hard to undo
5. Whenever I need to do something by hand (Google Cloud Console, Supabase dashboard, BotFather, Vercel env vars), stop and give me exact step-by-step instructions
6. Keep a `docs/DECISIONS.md` that briefly explains each major technical choice and why. I'm using this project to learn, so I'll read it.
7. Replace the README with what the app does, how to run it locally, and how it's deployed
