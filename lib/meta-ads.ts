/**
 * Meta Ad Library API client.
 *
 * Uses the official, FREE Meta Ad Library API.
 * Requires: Facebook Developer account + access token.
 * Docs: https://www.facebook.com/ads/library/api/
 *
 * No Apify needed — direct Graph API call.
 */

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface AdResult {
  id: string;
  page_name: string;
  page_id: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  impressions?: { lower_bound: string; upper_bound: string };
  spend?: { lower_bound: string; upper_bound: string };
  currency?: string;
  publisher_platforms?: string[];
  languages?: string[];
}

export interface AdsSearchParams {
  search_terms?: string;
  search_page_ids?: string[];
  ad_reached_countries: string[];
  ad_type?: "ALL" | "POLITICAL_AND_ISSUE_ADS" | "HOUSING_ADS" | "EMPLOYMENT_ADS";
  ad_active_status?: "ACTIVE" | "INACTIVE" | "ALL";
  limit?: number;
}

export interface AdsSearchResult {
  ads: AdResult[];
  error?: string;
}

export function requireMetaToken(): string {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Missing META_ADS_ACCESS_TOKEN. Get one at https://www.facebook.com/ads/library/api/ (free, no app review needed)"
    );
  }
  return token;
}

export async function searchAds(params: AdsSearchParams): Promise<AdsSearchResult> {
  const token = requireMetaToken();
  const limit = Math.min(params.limit || 50, 500);

  const fields = [
    "id",
    "page_name",
    "page_id",
    "ad_creative_bodies",
    "ad_creative_link_titles",
    "ad_creative_link_descriptions",
    "ad_delivery_start_time",
    "ad_delivery_stop_time",
    "ad_snapshot_url",
    "publisher_platforms",
    "languages",
  ].join(",");

  const url = new URL(`${GRAPH_API_BASE}/ads_archive`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", fields);
  url.searchParams.set("ad_reached_countries", JSON.stringify(params.ad_reached_countries));
  url.searchParams.set("ad_type", params.ad_type || "ALL");
  url.searchParams.set("limit", String(limit));

  if (params.search_terms) {
    url.searchParams.set("search_terms", params.search_terms);
  }
  if (params.search_page_ids?.length) {
    url.searchParams.set("search_page_ids", JSON.stringify(params.search_page_ids));
  }
  if (params.ad_active_status) {
    url.searchParams.set("ad_active_status", params.ad_active_status);
  }

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text();
    return { ads: [], error: `Meta Ad Library API error (${response.status}): ${body.slice(0, 500)}` };
  }

  const data = (await response.json()) as any;
  const ads: AdResult[] = data?.data || [];

  // Paginate if needed (up to limit)
  let allAds = [...ads];
  let nextUrl = data?.paging?.next;

  while (nextUrl && allAds.length < limit) {
    const pageRes = await fetch(nextUrl, { signal: AbortSignal.timeout(30_000) });
    if (!pageRes.ok) break;
    const pageData = (await pageRes.json()) as any;
    allAds.push(...(pageData?.data || []));
    nextUrl = pageData?.paging?.next;
  }

  return { ads: allAds.slice(0, limit) };
}
