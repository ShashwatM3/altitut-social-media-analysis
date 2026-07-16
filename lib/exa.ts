const EXA_BASE_URL = "https://api.exa.ai";

export type ExaResult = {
  title: string | null;
  url: string;
  publishedDate?: string | null;
  text?: string | null;
  highlights?: string[];
};

type ExaSearchOptions = {
  numResults?: number;
  category?: string;
  includeText?: boolean;
  maxCharacters?: number;
  includeDomains?: string[];
};

function exaKey(): string {
  const key = process.env.EXA_API_KEY;
  if (!key) {
    throw new Error("EXA_API_KEY is not set.");
  }
  return key;
}

async function exaRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${EXA_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": exaKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Exa ${path} failed (HTTP ${response.status}): ${detail.slice(0, 400)}`);
  }
  return response.json();
}

/** Neural/auto web search with optional page text, via Exa /search. */
export async function exaSearch(
  query: string,
  options: ExaSearchOptions = {},
): Promise<ExaResult[]> {
  const body: Record<string, unknown> = {
    query,
    type: "auto",
    numResults: options.numResults ?? 8,
  };
  if (options.category) {
    body.category = options.category;
  }
  if (options.includeDomains?.length) {
    body.includeDomains = options.includeDomains;
  }
  if (options.includeText) {
    body.contents = {
      text: { maxCharacters: options.maxCharacters ?? 2500 },
    };
  }
  const data = await exaRequest("/search", body);
  const results = Array.isArray(data?.results) ? data.results : [];
  return results
    .filter((result: unknown): result is Record<string, unknown> =>
      Boolean(result && typeof result === "object" && (result as Record<string, unknown>).url),
    )
    .map((result: Record<string, unknown>) => ({
      title: typeof result.title === "string" ? result.title : null,
      url: String(result.url),
      publishedDate:
        typeof result.publishedDate === "string" ? result.publishedDate : null,
      text: typeof result.text === "string" ? result.text : null,
      highlights: Array.isArray(result.highlights)
        ? result.highlights.map(String)
        : undefined,
    }));
}

/** Fetch page contents for specific URLs via Exa /contents (livecrawl fallback). */
export async function exaContents(
  urls: string[],
  maxCharacters = 6000,
): Promise<ExaResult[]> {
  if (urls.length === 0) {
    return [];
  }
  const data = await exaRequest("/contents", {
    urls,
    text: { maxCharacters },
    livecrawl: "fallback",
  });
  const results = Array.isArray(data?.results) ? data.results : [];
  return results
    .filter((result: unknown): result is Record<string, unknown> =>
      Boolean(result && typeof result === "object" && (result as Record<string, unknown>).url),
    )
    .map((result: Record<string, unknown>) => ({
      title: typeof result.title === "string" ? result.title : null,
      url: String(result.url),
      text: typeof result.text === "string" ? result.text : null,
    }));
}
