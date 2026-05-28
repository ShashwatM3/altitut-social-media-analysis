import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type IntegrationStatus = {
  provider: string;
  ready: boolean;
  status: string;
  missing_requirements: string[];
  next_steps: string[];
  docs_url: string;
  details: Record<string, unknown>;
};

type Competitor = {
  id: string;
  name: string;
  website?: string | null;
  social_links?: Record<string, string>;
  relevance_summary?: string;
  traction_summary?: string;
  approved?: boolean;
};

type Post = {
  id: string;
  competitor_id: string;
  competitor_name?: string;
  source_platform: string;
  source_url?: string | null;
  retrieval_mode: string;
  title?: string | null;
  caption?: string | null;
  transcript?: string | null;
  frames?: unknown[];
  traction?: Record<string, unknown>;
  analysis?: Record<string, unknown>;
  approved?: boolean;
  source_run_id?: string | null;
};

type ScoutCandidate = Competitor & {
  analysis?: Record<string, unknown>;
};

type ApiEnvelope<T> = {
  status?: string;
  post_count?: number;
  candidate_count?: number;
  candidates?: ScoutCandidate[];
  posts?: Post[];
  integration?: IntegrationStatus;
  run?: Record<string, unknown>;
  error?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const defaultScoutText = ["daviscurryclub", "ucdavis.startup", "sachacks"].join("\n");

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeScoutInputs(value: string): { usernames: string[]; profile_urls: string[] } {
  const usernames: string[] = [];
  const profile_urls: string[] = [];
  for (const entry of splitLines(value)) {
    if (entry.startsWith("http://") || entry.startsWith("https://")) {
      profile_urls.push(entry);
    } else {
      usernames.push(entry.replace(/^@+/, ""));
    }
  }
  return { usernames, profile_urls };
}

function getAnalysisSummary(analysis?: Record<string, unknown>): string {
  if (!analysis) {
    return "No analysis saved yet.";
  }
  const summary = analysis.summary;
  return typeof summary === "string" ? summary : "Analysis available.";
}

function App() {
  const [health, setHealth] = useState<string>("Loading...");
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [approvedCompetitors, setApprovedCompetitors] = useState<Competitor[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [scoutInput, setScoutInput] = useState(defaultScoutText);
  const [scoutResult, setScoutResult] = useState<ApiEnvelope<ScoutCandidate>>({});
  const [analysisResult, setAnalysisResult] = useState<ApiEnvelope<Post>>({});
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<string[]>([]);
  const [retrievalMode, setRetrievalMode] = useState("recent");
  const [postLimit, setPostLimit] = useState("4");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  async function loadDashboard() {
    try {
      setError("");
      const [healthRes, integrationRes, competitorsRes, postsRes] = await Promise.all([
        fetchJson<Record<string, unknown>>("/health"),
        fetchJson<IntegrationStatus>("/integrations/apify/status"),
        fetchJson<Competitor[]>("/competitors"),
        fetchJson<Post[]>("/posts?approved=true"),
      ]);
      setHealth(`${String(healthRes.status ?? "ok")} · ${String(healthRes.service ?? "backend")}`);
      setIntegration(integrationRes);
      setCompetitors(competitorsRes);
      setApprovedCompetitors(competitorsRes.filter((item) => item.approved));
      setPosts(postsRes);
      setSelectedCompetitorIds((current) =>
        current.filter((id) => competitorsRes.some((competitor) => competitor.id === id && competitor.approved)),
      );
      if (companyFilter !== "all" && !postsRes.some((post) => post.competitor_id === companyFilter)) {
        setCompanyFilter("all");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const companyOptions = useMemo(() => {
    const options = new Map<string, string>();
    options.set("all", "All companies");
    for (const competitor of approvedCompetitors) {
      options.set(competitor.id, competitor.name);
    }
    return Array.from(options.entries());
  }, [approvedCompetitors]);

  const filteredPosts = useMemo(() => {
    if (companyFilter === "all") {
      return posts;
    }
    return posts.filter((post) => post.competitor_id === companyFilter);
  }, [companyFilter, posts]);

  async function handleRunScout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("scout");
    setError("");
    try {
      const payload = normalizeScoutInputs(scoutInput);
      const response = await fetchJson<ApiEnvelope<ScoutCandidate>>("/competitor-scout", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setScoutResult(response);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Competitor scout failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleAnalyzePosts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("posts");
    setError("");
    try {
      const response = await fetchJson<ApiEnvelope<Post>>("/posts-analyze", {
        method: "POST",
        body: JSON.stringify({
          competitor_ids: selectedCompetitorIds,
          retrieval_mode: retrievalMode,
          post_limit: Number(postLimit),
        }),
      });
      setAnalysisResult(response);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Posts analysis failed.");
    } finally {
      setBusy(null);
    }
  }

  async function approveCompetitor(id: string) {
    setBusy(`approve-competitor-${id}`);
    setError("");
    try {
      await fetchJson(`/competitors/${id}/approve`, { method: "POST" });
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to approve competitor.");
    } finally {
      setBusy(null);
    }
  }

  async function approvePost(id: string) {
    setBusy(`approve-post-${id}`);
    setError("");
    try {
      await fetchJson(`/posts/${id}/approve`, { method: "POST" });
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to approve post.");
    } finally {
      setBusy(null);
    }
  }

  function toggleCompetitorSelection(id: string) {
    setSelectedCompetitorIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">ALTITUT SOCIAL MEDIA ANALYSIS</p>
          <h1>Competitor scout + posts analysis dashboard</h1>
          <p className="lead">
            Backend-first BMAD build with approved competitors, approved posts, and company-wise
            filtering.
          </p>
        </div>
        <div className="status-card">
          <span className="status-label">Backend</span>
          <strong>{health}</strong>
          <span className={integration?.ready ? "pill success" : "pill warning"}>
            {integration?.ready ? "Apify ready" : "Apify setup required"}
          </span>
        </div>
      </header>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Phase 2</p>
            <h2>Competitor Scout</h2>
          </div>
          <button type="button" className="secondary" onClick={() => void loadDashboard()}>
            Refresh data
          </button>
        </div>

        <form className="stack" onSubmit={handleRunScout}>
          <label className="field">
            Instagram usernames or profile URLs
            <textarea
              value={scoutInput}
              onChange={(event) => setScoutInput(event.target.value)}
              rows={4}
            />
          </label>
          <button type="submit" disabled={busy === "scout"}>
            {busy === "scout" ? "Running scout..." : "Run competitor scout"}
          </button>
        </form>

        <div className="grid two-up">
          <div>
            <h3>Returned candidates</h3>
            <div className="cards">
              {(scoutResult.candidates ?? []).map((candidate) => (
                <article className="card" key={candidate.id}>
                  <div className="card-top">
                    <div>
                      <strong>{candidate.name}</strong>
                      <p>{candidate.id}</p>
                    </div>
                    <span className={candidate.approved ? "pill success" : "pill neutral"}>
                      {candidate.approved ? "Approved" : "Pending"}
                    </span>
                  </div>
                  <p>{candidate.relevance_summary ?? "No relevance summary."}</p>
                  <p className="muted">{candidate.traction_summary ?? "No traction summary."}</p>
                  {!candidate.approved ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void approveCompetitor(candidate.id)}
                      disabled={busy === `approve-competitor-${candidate.id}`}
                    >
                      Approve competitor
                    </button>
                  ) : null}
                </article>
              ))}
              {!scoutResult.candidates?.length ? <p className="muted">No scout run yet.</p> : null}
            </div>
          </div>

          <div>
            <h3>Approved competitors</h3>
            <div className="cards">
              {competitors.map((competitor) => (
                <article className="card" key={competitor.id}>
                  <div className="card-top">
                    <strong>{competitor.name}</strong>
                    <span className={competitor.approved ? "pill success" : "pill warning"}>
                      {competitor.approved ? "Approved" : "Pending"}
                    </span>
                  </div>
                  <p className="muted">{competitor.website ?? "No website saved."}</p>
                  {!competitor.approved ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void approveCompetitor(competitor.id)}
                      disabled={busy === `approve-competitor-${competitor.id}`}
                    >
                      Approve competitor
                    </button>
                  ) : null}
                </article>
              ))}
              {!competitors.length ? <p className="muted">No competitors saved yet.</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Phase 3</p>
            <h2>Posts Analysis</h2>
          </div>
          <span className="pill neutral">No search · company filter only</span>
        </div>

        <form className="stack" onSubmit={handleAnalyzePosts}>
          <div className="grid two-up">
            <label className="field">
              Retrieval mode
              <select value={retrievalMode} onChange={(event) => setRetrievalMode(event.target.value)}>
                <option value="recent">Most Recent Posts</option>
                <option value="popular">Most Popular Posts</option>
              </select>
            </label>
            <label className="field">
              Posts per company
              <input
                type="number"
                min="1"
                max="20"
                value={postLimit}
                onChange={(event) => setPostLimit(event.target.value)}
              />
            </label>
          </div>

          <div className="stack">
            <span className="field-label">Approved companies to analyze</span>
            <div className="selector-grid">
              {approvedCompetitors.map((competitor) => (
                <label className="checkbox-card" key={competitor.id}>
                  <input
                    type="checkbox"
                    checked={selectedCompetitorIds.includes(competitor.id)}
                    onChange={() => toggleCompetitorSelection(competitor.id)}
                  />
                  <span>{competitor.name}</span>
                </label>
              ))}
              {!approvedCompetitors.length ? (
                <p className="muted">Approve competitors first to enable posts analysis.</p>
              ) : null}
            </div>
          </div>

          <button type="submit" disabled={busy === "posts" || !selectedCompetitorIds.length}>
            {busy === "posts" ? "Analyzing posts..." : "Analyze posts"}
          </button>
        </form>

        <div className="grid two-up">
          <div>
            <h3>Latest analysis run</h3>
            <div className="cards">
              {(analysisResult.posts ?? []).map((post) => (
                <article className="card" key={post.id}>
                  <div className="card-top">
                    <div>
                      <strong>{post.competitor_name ?? post.competitor_id}</strong>
                      <p>{post.title ?? post.id}</p>
                    </div>
                    <span className={post.approved ? "pill success" : "pill neutral"}>
                      {post.approved ? "Approved" : "Pending"}
                    </span>
                  </div>
                  <p>{getAnalysisSummary(post.analysis)}</p>
                  <p className="muted">{post.caption ?? "No caption captured."}</p>
                  {!post.approved ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void approvePost(post.id)}
                      disabled={busy === `approve-post-${post.id}`}
                    >
                      Approve post
                    </button>
                  ) : null}
                </article>
              ))}
              {!analysisResult.posts?.length ? <p className="muted">No post analysis yet.</p> : null}
            </div>
          </div>

          <div>
            <h3>Approved posts feed</h3>
            <label className="field compact">
              Company filter
              <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
                {companyOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="cards">
              {filteredPosts.map((post) => (
                <article className="card" key={post.id}>
                  <div className="card-top">
                    <div>
                      <strong>{post.competitor_name ?? post.competitor_id}</strong>
                      <p>{post.title ?? post.id}</p>
                    </div>
                    <span className="pill success">Approved</span>
                  </div>
                  <p>{getAnalysisSummary(post.analysis)}</p>
                  <p className="muted">{post.caption ?? "No caption captured."}</p>
                </article>
              ))}
              {!filteredPosts.length ? <p className="muted">No approved posts for this filter yet.</p> : null}
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>
          {integration?.status === "setup_required"
            ? "Apify setup is still required in the local environment."
            : "Apify integration ready for backend execution."}
        </span>
      </footer>
    </div>
  );
}

export { App };
