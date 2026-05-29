import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

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
  rejected?: boolean;
  source_run_id?: string | null;
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
  rejected?: boolean;
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

type ReviewDecision = "approved" | "rejected";
type ReviewKind = "competitors" | "posts";
type ReviewState = {
  competitors: Record<string, ReviewDecision>;
  posts: Record<string, ReviewDecision>;
};

type ReviewStatus = "approved" | "rejected" | "pending";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const REVIEW_STORAGE_KEY = "altitut.dashboard.review-state.v1";

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

async function fetchOptionalJson<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
      ...options,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
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

function getReviewDecision(
  item: { approved?: boolean; rejected?: boolean },
  localDecision?: ReviewDecision,
): ReviewStatus {
  if (localDecision === "approved") {
    return "approved";
  }
  if (localDecision === "rejected") {
    return "rejected";
  }
  if (item.approved) {
    return "approved";
  }
  if (item.rejected) {
    return "rejected";
  }
  return "pending";
}

function readStoredReviewState(): ReviewState {
  if (typeof window === "undefined") {
    return { competitors: {}, posts: {} };
  }
  try {
    const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY);
    if (!raw) {
      return { competitors: {}, posts: {} };
    }
    const parsed = JSON.parse(raw) as Partial<ReviewState>;
    return {
      competitors: parsed.competitors ?? {},
      posts: parsed.posts ?? {},
    };
  } catch {
    return { competitors: {}, posts: {} };
  }
}

function statusTone(status?: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "approved" || status === "ready" || status === "completed") {
    return "success";
  }
  if (status === "setup_required") {
    return "warning";
  }
  if (status === "failed" || status === "error" || status === "rejected") {
    return "danger";
  }
  return "neutral";
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function renderRecordPreview(record?: Record<string, unknown>, maxEntries = 4): ReactNode {
  if (!record || Object.keys(record).length === 0) {
    return <p className="muted">No extra details saved.</p>;
  }

  const entries = Object.entries(record).slice(0, maxEntries);
  return (
    <dl className="detail-grid">
      {entries.map(([key, value]) => (
        <div className="detail-row" key={key}>
          <dt>{key.replace(/_/g, " ")}</dt>
          <dd>{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}

function SetupBanner({
  title,
  integration,
  tone,
}: {
  title: string;
  integration: IntegrationStatus;
  tone: "apify" | "llm";
}) {
  const toneClass = tone === "apify" ? "apify" : "llm";
  return (
    <div className={`setup-banner ${toneClass}`}>
      <div className="setup-banner-copy">
        <span className="eyebrow">Setup required</span>
        <h3>{title}</h3>
        <p>
          {integration.status === "setup_required"
            ? `This integration is missing configuration before it can be used. ${tone === "apify" ? "Competitor scouting and post analysis depend on it." : "LLM-backed analysis may be unavailable until it is configured."}`
            : "This integration is currently unavailable in the current environment."}
        </p>
      </div>
      <div className="setup-banner-meta">
        <span className={`pill ${statusTone(integration.status)}`}>{integration.status.replace(/_/g, " ")}</span>
        {integration.missing_requirements.length ? (
          <div>
            <span className="field-label">Missing requirements</span>
            <ul>
              {integration.missing_requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {integration.next_steps.length ? (
          <div>
            <span className="field-label">Next steps</span>
            <ul>
              {integration.next_steps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {integration.docs_url ? (
          <a href={integration.docs_url} target="_blank" rel="noreferrer">
            View docs
          </a>
        ) : null}
      </div>
    </div>
  );
}

function RunSummary({
  title,
  envelope,
  countLabel,
}: {
  title: string;
  envelope: ApiEnvelope<unknown>;
  countLabel: string;
}) {
  if (!envelope.status) {
    return null;
  }

  const count = envelope.candidate_count ?? envelope.post_count;
  const tone = statusTone(envelope.status);
  return (
    <div className={`run-summary ${tone}`}>
      <div>
        <strong>{title}</strong>
        <p>{envelope.error ?? `Last run ${envelope.status.replace(/_/g, " ")}.`}</p>
      </div>
      <div className="run-summary-meta">
        <span className={`pill ${tone}`}>{envelope.status.replace(/_/g, " ")}</span>
        {typeof count === "number" ? <span className="muted">{count} {countLabel}</span> : null}
      </div>
    </div>
  );
}

function ReviewControls({
  status,
  onApprove,
  onReject,
  approveLabel,
  rejectLabel,
  busyApprove,
  busyReject,
  canApprove = true,
}: {
  status: ReviewStatus;
  onApprove: () => void;
  onReject: () => void;
  approveLabel: string;
  rejectLabel: string;
  busyApprove?: boolean;
  busyReject?: boolean;
  canApprove?: boolean;
}) {
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  return (
    <div className="card-actions">
      {!isApproved ? (
        <button type="button" onClick={onApprove} disabled={busyApprove || !canApprove}>
          {busyApprove ? "Saving..." : approveLabel}
        </button>
      ) : null}
      {!isRejected ? (
        <button type="button" className="secondary danger" onClick={onReject} disabled={busyReject}>
          {busyReject ? "Saving..." : rejectLabel}
        </button>
      ) : null}
    </div>
  );
}

function ActionCard({
  title,
  subtitle,
  status,
  statusLabel,
  headerRight,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  status: ReviewStatus;
  statusLabel: string;
  headerRight?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <details className={`card review-card ${status}`}>
      <summary>
        <div className="card-summary-left">
          <strong>{title}</strong>
          <p>{subtitle}</p>
        </div>
        <div className="card-summary-right">
          <span className={`pill ${statusTone(status)}`}>{statusLabel}</span>
          {headerRight}
        </div>
      </summary>
      <div className="card-body">
        {children}
        {footer ? <div className="card-footer">{footer}</div> : null}
      </div>
    </details>
  );
}

function App() {
  const [health, setHealth] = useState<string>("Loading backend...");
  const [apifyIntegration, setApifyIntegration] = useState<IntegrationStatus | null>(null);
  const [llmIntegration, setLlmIntegration] = useState<IntegrationStatus | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
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
  const [notice, setNotice] = useState<string>("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [reviewState, setReviewState] = useState<ReviewState>(() => readStoredReviewState());

  useEffect(() => {
    try {
      window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviewState));
    } catch {
      // Ignore storage failures; review state still works in-memory.
    }
  }, [reviewState]);

  async function loadDashboard(options?: { preserveNotice?: boolean }) {
    setError("");
    if (!options?.preserveNotice) {
      setNotice("");
    }
    try {
      const [healthRes, apifyRes, llmRes, competitorsRes, postsRes] = await Promise.all([
        fetchJson<Record<string, unknown>>("/health"),
        fetchJson<IntegrationStatus>("/integrations/apify/status"),
        fetchOptionalJson<IntegrationStatus>("/integrations/llm/status"),
        fetchJson<Competitor[]>("/competitors"),
        fetchJson<Post[]>("/posts?approved=true"),
      ]);

      setHealth(`${String(healthRes.status ?? "ok")} · ${String(healthRes.service ?? "backend")}`);
      setApifyIntegration(apifyRes);
      setLlmIntegration(llmRes);
      setCompetitors(competitorsRes);
      setPosts(postsRes);
      setSelectedCompetitorIds((current) => {
        const approvedIds = competitorsRes
          .filter((competitor) => getReviewDecision(competitor, reviewState.competitors[competitor.id]) === "approved")
          .map((competitor) => competitor.id);
        const retained = current.filter((id) => approvedIds.includes(id));
        if (retained.length > 0 || current.length > 0) {
          return retained;
        }
        return approvedIds;
      });
      if (companyFilter !== "all" && !postsRes.some((post) => post.competitor_id === companyFilter)) {
        setCompanyFilter("all");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const competitorRows = useMemo(
    () =>
      competitors.map((competitor) => ({
        competitor,
        localDecision: reviewState.competitors[competitor.id],
        status: getReviewDecision(competitor, reviewState.competitors[competitor.id]),
      })),
    [competitors, reviewState],
  );

  const approvedCompetitors = useMemo(
    () => competitorRows.filter((row) => row.status === "approved").map((row) => row.competitor),
    [competitorRows],
  );

  const companyOptions = useMemo(() => {
    const options = new Map<string, string>();
    options.set("all", "All companies");
    for (const competitor of approvedCompetitors) {
      options.set(competitor.id, competitor.name);
    }
    return Array.from(options.entries());
  }, [approvedCompetitors]);

  const postRows = useMemo(
    () =>
      posts.map((post) => ({
        post,
        localDecision: reviewState.posts[post.id],
        status: getReviewDecision(post, reviewState.posts[post.id]),
      })),
    [posts, reviewState],
  );

  const approvedPosts = useMemo(
    () => postRows.filter((row) => row.status === "approved").map((row) => row.post),
    [postRows],
  );

  const filteredApprovedPosts = useMemo(() => {
    if (companyFilter === "all") {
      return approvedPosts;
    }
    return approvedPosts.filter((post) => post.competitor_id === companyFilter);
  }, [approvedPosts, companyFilter]);

  async function runCompetitorScout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("scout");
    setError("");
    setNotice("");
    try {
      const payload = normalizeScoutInputs(scoutInput);
      const response = await fetchJson<ApiEnvelope<ScoutCandidate>>("/competitor-scout", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setScoutResult(response);
      await loadDashboard({ preserveNotice: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Competitor scout failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runPostsAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("posts");
    setError("");
    setNotice("");
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
      await loadDashboard({ preserveNotice: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Posts analysis failed.");
    } finally {
      setBusy(null);
    }
  }

  async function mutateReviewState(kind: ReviewKind, id: string, decision: ReviewDecision) {
    setReviewState((current) => ({
      ...current,
      [kind]: {
        ...current[kind],
        [id]: decision,
      },
    }));
  }

  async function attemptBackendReview(paths: string[]): Promise<boolean> {
    for (const path of paths) {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        return true;
      }
      if (response.status === 404 || response.status === 405) {
        continue;
      }
      const text = await response.text();
      throw new Error(text || `Request failed: ${response.status}`);
    }
    return false;
  }

  async function approveCompetitor(id: string) {
    setBusy(`approve-competitor-${id}`);
    setError("");
    setNotice("");
    try {
      await fetchJson(`/competitors/${id}/approve`, { method: "POST" });
      await mutateReviewState("competitors", id, "approved");
      setNotice("Competitor approved.");
      await loadDashboard({ preserveNotice: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to approve competitor.");
    } finally {
      setBusy(null);
    }
  }

  async function rejectCompetitor(id: string) {
    setBusy(`reject-competitor-${id}`);
    setError("");
    setNotice("");
    try {
      const persisted = await attemptBackendReview([`/competitors/${id}/reject`, `/competitors/${id}/dismiss`]);
      await mutateReviewState("competitors", id, "rejected");
      setNotice(
        persisted
          ? "Competitor dismissed."
          : "Reject route not available yet; competitor dismissed locally in this browser.",
      );
      await loadDashboard({ preserveNotice: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to dismiss competitor.");
    } finally {
      setBusy(null);
    }
  }

  async function approvePost(id: string) {
    setBusy(`approve-post-${id}`);
    setError("");
    setNotice("");
    try {
      await fetchJson(`/posts/${id}/approve`, { method: "POST" });
      await mutateReviewState("posts", id, "approved");
      setNotice("Post approved.");
      await loadDashboard({ preserveNotice: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to approve post.");
    } finally {
      setBusy(null);
    }
  }

  async function rejectPost(id: string) {
    setBusy(`reject-post-${id}`);
    setError("");
    setNotice("");
    try {
      const persisted = await attemptBackendReview([`/posts/${id}/reject`, `/posts/${id}/dismiss`]);
      await mutateReviewState("posts", id, "rejected");
      setNotice(persisted ? "Post dismissed." : "Reject route not available yet; post dismissed locally in this browser.");
      await loadDashboard({ preserveNotice: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to dismiss post.");
    } finally {
      setBusy(null);
    }
  }

  function toggleCompetitorSelection(id: string) {
    setSelectedCompetitorIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  const apifySetupRequired = apifyIntegration?.status === "setup_required" || !apifyIntegration?.ready;
  const llmSetupRequired = Boolean(llmIntegration && !llmIntegration.ready);
  const selectedApprovedCompetitors = approvedCompetitors.filter((competitor) => selectedCompetitorIds.includes(competitor.id));

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">ALTITUT SOCIAL MEDIA ANALYSIS</p>
          <h1>Competitor scout + posts analysis dashboard</h1>
          <p className="lead">
            Backend-first workflow with explicit setup state, review controls, and company-wise filtering.
          </p>
        </div>
        <div className="status-card">
          <span className="status-label">Backend</span>
          <strong>{health}</strong>
          <div className="status-stack">
            <span className={`pill ${apifySetupRequired ? "warning" : "success"}`}>
              Apify {apifySetupRequired ? "setup required" : "ready"}
            </span>
            {llmIntegration ? (
              <span className={`pill ${llmSetupRequired ? "warning" : "success"}`}>
                LLM {llmSetupRequired ? "setup required" : "ready"}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {error ? <div className="alert error">{error}</div> : null}
      {notice ? <div className="alert info">{notice}</div> : null}

      {apifySetupRequired && apifyIntegration ? (
        <SetupBanner title="Apify integration needs setup" integration={apifyIntegration} tone="apify" />
      ) : null}
      {llmSetupRequired && llmIntegration ? (
        <SetupBanner title="LLM integration needs setup" integration={llmIntegration} tone="llm" />
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Phase 2</p>
            <h2>Competitor Scout</h2>
          </div>
          <button type="button" className="secondary" onClick={() => void loadDashboard()}>
            {dashboardLoading ? "Loading..." : "Refresh data"}
          </button>
        </div>

        <form className="stack" onSubmit={runCompetitorScout}>
          <label className="field">
            Instagram usernames or profile URLs
            <textarea
              value={scoutInput}
              onChange={(event) => setScoutInput(event.target.value)}
              rows={4}
            />
          </label>
          <div className="inline-hint">
            <span className="muted">One username or profile URL per line.</span>
            {apifySetupRequired ? <span className="pill warning">Apify setup required before scouting</span> : null}
          </div>
          <button type="submit" disabled={busy === "scout" || dashboardLoading}>
            {busy === "scout" ? "Running scout..." : "Run competitor scout"}
          </button>
        </form>

        <RunSummary title="Latest scout run" envelope={scoutResult} countLabel="candidates" />

        <div className="grid two-up">
          <div>
            <div className="section-title-row">
              <h3>Returned candidates</h3>
              <span className="muted">{scoutResult.candidate_count ?? scoutResult.candidates?.length ?? 0} saved candidate(s)</span>
            </div>
            <div className="cards">
              {dashboardLoading ? (
                <div className="loading-stack">
                  <div className="card skeleton" />
                  <div className="card skeleton" />
                </div>
              ) : scoutResult.candidates?.length ? (
                scoutResult.candidates.map((candidate) => {
                  const localDecision = reviewState.competitors[candidate.id];
                  const status = getReviewDecision(candidate, localDecision);
                  return (
                    <ActionCard
                      key={candidate.id}
                      title={candidate.name}
                      subtitle={`${candidate.id} · ${candidate.website ?? "No website saved"}`}
                      status={status}
                      statusLabel={status === "approved" ? "Approved" : status === "rejected" ? "Dismissed" : "Pending review"}
                      headerRight={<span className="muted">{candidate.social_links ? Object.keys(candidate.social_links).length : 0} social link(s)</span>}
                      footer={
                        <ReviewControls
                          status={status}
                          approveLabel={status === "approved" ? "Approved" : status === "rejected" ? "Restore" : "Approve"}
                          rejectLabel={status === "rejected" ? "Dismissed" : "Dismiss"}
                          onApprove={() => void approveCompetitor(candidate.id)}
                          onReject={() => void rejectCompetitor(candidate.id)}
                          busyApprove={busy === `approve-competitor-${candidate.id}`}
                          busyReject={busy === `reject-competitor-${candidate.id}`}
                          canApprove={!candidate.approved || status === "rejected"}
                        />
                      }
                    >
                      <p>{candidate.relevance_summary ?? "No relevance summary yet."}</p>
                      <p className="muted">{candidate.traction_summary ?? "No traction summary yet."}</p>
                      {renderRecordPreview(candidate.analysis)}
                    </ActionCard>
                  );
                })
              ) : (
                <EmptyState
                  title="No scout run yet"
                  description="Run the competitor scout to collect candidate competitors. Returned candidates appear here with approve and dismiss controls."
                />
              )}
            </div>
          </div>

          <div>
            <div className="section-title-row">
              <h3>Competitor review board</h3>
              <span className="muted">
                {approvedCompetitors.length} approved · {competitorRows.length} total
              </span>
            </div>
            <div className="cards">
              {dashboardLoading ? (
                <div className="loading-stack">
                  <div className="card skeleton" />
                  <div className="card skeleton" />
                </div>
              ) : competitorRows.length ? (
                competitorRows.map(({ competitor, status, localDecision }) => (
                  <ActionCard
                    key={competitor.id}
                    title={competitor.name}
                    subtitle={`${competitor.id} · ${competitor.website ?? "No website saved"}`}
                    status={status}
                    statusLabel={status === "approved" ? "Approved" : status === "rejected" ? "Dismissed" : "Pending review"}
                    headerRight={<span className="muted">{competitor.source_run_id ?? "Manual"}</span>}
                    footer={
                      <ReviewControls
                        status={status}
                        approveLabel={status === "approved" ? "Approved" : status === "rejected" ? "Restore" : "Approve"}
                        rejectLabel={status === "rejected" ? "Dismissed" : "Dismiss"}
                        onApprove={() => void approveCompetitor(competitor.id)}
                        onReject={() => void rejectCompetitor(competitor.id)}
                        busyApprove={busy === `approve-competitor-${competitor.id}`}
                        busyReject={busy === `reject-competitor-${competitor.id}`}
                        canApprove={status !== "approved" || localDecision === "rejected"}
                      />
                    }
                  >
                    <p>{competitor.relevance_summary ?? "No relevance summary yet."}</p>
                    <p className="muted">{competitor.traction_summary ?? "No traction summary yet."}</p>
                    {competitor.social_links && Object.keys(competitor.social_links).length ? (
                      <div className="link-cloud">
                        {Object.entries(competitor.social_links).map(([platform, url]) => (
                          <a key={platform} href={url} target="_blank" rel="noreferrer">
                            {platform}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </ActionCard>
                ))
              ) : (
                <EmptyState
                  title="No competitors saved yet"
                  description="Run the scout and approve competitors before analysis can use them. Approved competitors populate the analysis picker below."
                  action={<span className="pill neutral">Approve candidates to unlock posts analysis</span>}
                />
              )}
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
          <span className="pill neutral">Company filter only · no free-text search</span>
        </div>

        <form className="stack" onSubmit={runPostsAnalysis}>
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
            <div className="inline-hint">
              <span className="muted">
                {selectedApprovedCompetitors.length
                  ? `${selectedApprovedCompetitors.length} approved competitor(s) selected.`
                  : "Select at least one approved competitor to run analysis."}
              </span>
              {llmSetupRequired ? <span className="pill warning">LLM setup required</span> : null}
            </div>
          </div>

          <button type="submit" disabled={busy === "posts" || !selectedCompetitorIds.length || dashboardLoading}>
            {busy === "posts" ? "Analyzing posts..." : "Analyze posts"}
          </button>
        </form>

        <RunSummary title="Latest analysis run" envelope={analysisResult} countLabel="posts" />

        <div className="grid two-up">
          <div>
            <div className="section-title-row">
              <h3>Latest analysis run</h3>
              <span className="muted">{analysisResult.post_count ?? analysisResult.posts?.length ?? 0} post(s)</span>
            </div>
            <div className="cards">
              {dashboardLoading ? (
                <div className="loading-stack">
                  <div className="card skeleton" />
                  <div className="card skeleton" />
                </div>
              ) : analysisResult.posts?.length ? (
                analysisResult.posts.map((post) => {
                  const localDecision = reviewState.posts[post.id];
                  const status = getReviewDecision(post, localDecision);
                  return (
                    <ActionCard
                      key={post.id}
                      title={post.competitor_name ?? post.competitor_id}
                      subtitle={`${post.title ?? post.id} · ${post.source_platform}`}
                      status={status}
                      statusLabel={status === "approved" ? "Approved" : status === "rejected" ? "Dismissed" : "Pending review"}
                      headerRight={<span className="muted">{post.retrieval_mode}</span>}
                      footer={
                        <ReviewControls
                          status={status}
                          approveLabel={status === "approved" ? "Approved" : status === "rejected" ? "Restore" : "Approve"}
                          rejectLabel={status === "rejected" ? "Dismissed" : "Dismiss"}
                          onApprove={() => void approvePost(post.id)}
                          onReject={() => void rejectPost(post.id)}
                          busyApprove={busy === `approve-post-${post.id}`}
                          busyReject={busy === `reject-post-${post.id}`}
                          canApprove={status !== "approved" || localDecision === "rejected"}
                        />
                      }
                    >
                      <p>{getAnalysisSummary(post.analysis)}</p>
                      <p className="muted">{post.caption ?? "No caption captured."}</p>
                      {post.source_url ? (
                        <a href={post.source_url} target="_blank" rel="noreferrer">
                          Open source post
                        </a>
                      ) : null}
                      <div className="detail-stack">
                        {renderRecordPreview(post.traction, 3)}
                        {renderRecordPreview(post.analysis, 3)}
                      </div>
                    </ActionCard>
                  );
                })
              ) : (
                <EmptyState
                  title="No post analysis yet"
                  description="Run analysis on approved competitors to populate the latest analysis run. Each returned post can be approved or dismissed individually."
                />
              )}
            </div>
          </div>

          <div>
            <div className="section-title-row">
              <h3>Approved posts feed</h3>
              <span className="muted">{approvedPosts.length} approved</span>
            </div>
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
              {dashboardLoading ? (
                <div className="loading-stack">
                  <div className="card skeleton" />
                  <div className="card skeleton" />
                </div>
              ) : filteredApprovedPosts.length ? (
                filteredApprovedPosts.map((post) => {
                  const localDecision = reviewState.posts[post.id];
                  const status = getReviewDecision(post, localDecision);
                  return (
                    <ActionCard
                      key={post.id}
                      title={post.competitor_name ?? post.competitor_id}
                      subtitle={`${post.title ?? post.id} · ${post.source_platform}`}
                      status={status}
                      statusLabel={status === "approved" ? "Approved" : status === "rejected" ? "Dismissed" : "Pending review"}
                      headerRight={<span className="muted">{post.source_run_id ?? "Manual"}</span>}
                      footer={
                        <ReviewControls
                          status={status}
                          approveLabel={status === "approved" ? "Approved" : status === "rejected" ? "Restore" : "Approve"}
                          rejectLabel={status === "rejected" ? "Dismissed" : "Dismiss"}
                          onApprove={() => void approvePost(post.id)}
                          onReject={() => void rejectPost(post.id)}
                          busyApprove={busy === `approve-post-${post.id}`}
                          busyReject={busy === `reject-post-${post.id}`}
                          canApprove={status !== "approved" || localDecision === "rejected"}
                        />
                      }
                    >
                      <p>{getAnalysisSummary(post.analysis)}</p>
                      <p className="muted">{post.caption ?? "No caption captured."}</p>
                      {post.source_url ? (
                        <a href={post.source_url} target="_blank" rel="noreferrer">
                          Open source post
                        </a>
                      ) : null}
                    </ActionCard>
                  );
                })
              ) : companyFilter === "all" ? (
                <EmptyState
                  title="No approved posts yet"
                  description="Approved posts will appear here after analysis and approval. Use the company filter to narrow the feed once it has content."
                />
              ) : (
                <EmptyState
                  title="No approved posts for this company"
                  description="Choose a different company filter or approve posts from another analysis run."
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>
          {apifyIntegration?.status === "setup_required"
            ? "Apify setup is required for scouting and post retrieval in this environment."
            : "Apify integration is ready for backend execution."}
        </span>
      </footer>
    </div>
  );
}

export { App };
