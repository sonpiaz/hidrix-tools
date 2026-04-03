/**
 * GetXAPI client — cheapest Twitter/X API.
 * $0.001/call, ~20 results/call, no rate limits.
 * Docs: https://docs.getxapi.com
 */

const BASE_URL = "https://api.getxapi.com";

export interface GetXApiResult {
  data: any;
  error?: string;
}

export function requireGetXApiKey(): string {
  const key = process.env.GETXAPI_KEY;
  if (!key) throw new Error("Missing GETXAPI_KEY. Get one at https://getxapi.com (pay-per-call, no subscription)");
  return key;
}

export async function getxApiGet(path: string, params: Record<string, string | number>): Promise<GetXApiResult> {
  const key = requireGetXApiKey();
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text();
    return { data: null, error: `GetXAPI error (${response.status}): ${body.slice(0, 500)}` };
  }

  const data = await response.json();
  return { data };
}

/**
 * Paginated fetch — collect up to `limit` items across multiple pages.
 */
export async function getxApiPaginated(
  path: string,
  params: Record<string, string | number>,
  itemsKey: string,
  limit: number
): Promise<GetXApiResult> {
  const allItems: any[] = [];
  let cursor: string | undefined;

  while (allItems.length < limit) {
    const p = { ...params } as Record<string, string | number>;
    if (cursor) p.cursor = cursor;

    const result = await getxApiGet(path, p);
    if (result.error) return { data: allItems, error: result.error };

    const items = result.data?.[itemsKey] || [];
    if (!Array.isArray(items) || items.length === 0) break;

    allItems.push(...items);
    cursor = result.data?.next_cursor;
    if (!cursor || !result.data?.has_more) break;
  }

  return { data: allItems.slice(0, limit) };
}
