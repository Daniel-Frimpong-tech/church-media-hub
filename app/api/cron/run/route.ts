import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cronSecret } from "@/lib/env";
import { runScheduledJobs } from "@/lib/jobs/run";

// Creating Drive folders for a new service takes a few seconds.
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Called by the schedulers (Supabase every 15 minutes, Vercel once a day as a
 * backup). Creates recurring services, sends reminders and handoff alerts that
 * have fallen due, and tidies up. Running it more often than needed is
 * harmless: every action is recorded and done once.
 */
async function run(request: NextRequest) {
  if (!authorized(request)) return new Response(null, { status: 401 });
  return NextResponse.json(await runScheduledJobs());
}

// Supabase's scheduler sends POST; Vercel's sends GET.
export const GET = run;
export const POST = run;
