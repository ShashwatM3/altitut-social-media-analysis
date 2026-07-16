const APIFY_BASE_URL = "https://api.apify.com/v2";

function apifyToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN is not set.");
  }
  return token;
}

/**
 * Run an Apify actor synchronously and return its dataset items.
 * `actorId` uses the store slug form, e.g. "apify/instagram-profile-scraper".
 */
export async function runActorSync(
  actorId: string,
  input: Record<string, unknown>,
  timeoutSeconds = 120,
): Promise<Record<string, unknown>[]> {
  const encoded = encodeURIComponent(actorId.replace("/", "~"));
  const url = `${APIFY_BASE_URL}/acts/${encoded}/run-sync-get-dataset-items?timeout=${timeoutSeconds}&format=json&clean=true`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apifyToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout((timeoutSeconds + 30) * 1000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Apify actor ${actorId} failed (HTTP ${response.status}): ${detail.slice(0, 400)}`,
    );
  }
  const items = await response.json();
  if (!Array.isArray(items)) {
    return [];
  }
  return items.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object",
  );
}

/** Scrape one or more Instagram profiles (followers, bio, recent posts). */
export async function scrapeInstagramProfiles(
  usernames: string[],
): Promise<Record<string, unknown>[]> {
  return runActorSync(
    process.env.APIFY_ACTOR_ID || "apify/instagram-profile-scraper",
    { usernames, includeAboutSection: false },
    150,
  );
}

/** Scrape a single Instagram post/reel URL for caption, stats, and video URL. */
export async function scrapeInstagramPost(
  postUrl: string,
): Promise<Record<string, unknown> | null> {
  const items = await runActorSync(
    "apify/instagram-scraper",
    {
      directUrls: [postUrl],
      resultsType: "details",
      resultsLimit: 1,
      addParentData: false,
    },
    240,
  );
  return items[0] ?? null;
}
