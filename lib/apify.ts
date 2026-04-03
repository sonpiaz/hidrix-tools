/**
 * Apify client helper.
 *
 * Runs Apify Actors via REST API:
 *   1. Start actor run
 *   2. Poll until finished
 *   3. Fetch dataset items
 *
 * No SDK dependency — just native fetch.
 */

const APIFY_BASE = "https://api.apify.com/v2";
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_MS = 300_000; // 5 minutes

export interface ApifyRunResult {
  items: any[];
  error?: string;
}

export function requireApifyToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("Missing APIFY_API_TOKEN. Get one at https://console.apify.com/settings/integrations");
  return token;
}

/**
 * Run an Apify Actor synchronously (start → poll → fetch results).
 */
export async function runActor(actorId: string, input: Record<string, any>, timeoutMs = MAX_POLL_MS): Promise<ApifyRunResult> {
  const token = requireApifyToken();

  // 1. Start the run (actor IDs use ~ separator for Apify API)
  const safeActorId = actorId.replace("/", "~");
  const startRes = await fetch(`${APIFY_BASE}/acts/${safeActorId}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });

  if (!startRes.ok) {
    const body = await startRes.text();
    return { items: [], error: `Apify start failed (${startRes.status}): ${body.slice(0, 500)}` };
  }

  const runData = (await startRes.json()) as any;
  const runId = runData?.data?.id;
  if (!runId) return { items: [], error: "Apify: no run ID returned" };

  const datasetId = runData?.data?.defaultDatasetId;

  // 2. Poll until finished
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!statusRes.ok) continue;

    const statusData = (await statusRes.json()) as any;
    const status = statusData?.data?.status;

    if (status === "SUCCEEDED") break;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      return { items: [], error: `Apify run ${status}: ${statusData?.data?.statusMessage || ""}` };
    }
  }

  // 3. Fetch dataset items
  const dsId = datasetId || runData?.data?.defaultDatasetId;
  if (!dsId) return { items: [], error: "Apify: no dataset ID" };

  const itemsRes = await fetch(`${APIFY_BASE}/datasets/${dsId}/items?token=${token}&format=json&limit=10000`, {
    signal: AbortSignal.timeout(60_000),
  });

  if (!itemsRes.ok) {
    return { items: [], error: `Apify dataset fetch failed: ${itemsRes.status}` };
  }

  const items = (await itemsRes.json()) as any[];
  return { items: Array.isArray(items) ? items : [] };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
