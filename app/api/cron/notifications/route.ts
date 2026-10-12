import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cronSecret } from "@/lib/env";
import { sendDueNotifications } from "@/lib/notifications/telegram";

function authorized(request: NextRequest): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Called on a schedule. Sends any reminders and handoff alerts that have
 * fallen due. Running it more often than needed is harmless: each message is
 * recorded and sent once.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return new Response(null, { status: 401 });
  return NextResponse.json(await sendDueNotifications());
}

export const GET = POST;
