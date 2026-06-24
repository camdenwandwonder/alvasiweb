import { NextResponse } from "next/server";
import { processSyncQueue } from "@/lib/jamespro/sync";

export const dynamic = "force-dynamic";

/**
 * Processes the JamesPRO sync queue (pending + retryable errors). Invoked by the
 * Vercel cron as a safety net; most orders are already synced via `after()` in
 * the order actions. Protected by CRON_SECRET when set.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }
  const result = await processSyncQueue();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
