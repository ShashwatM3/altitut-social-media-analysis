import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

type ApiEnvelope<T> = {
	status?: string;
	post_count?: number;
	candidate_count?: number;
	candidates?: Competitor[];
	posts?: T[];
	error?: string;
};

type ReviewDecision = "approved" | "rejected";
type ReviewState = {
	competitors: Record<string, ReviewDecision>;
	posts: Record<string, ReviewDecision>;
};
type ReviewStatus = "approved" | "rejected" | "pending";

type DatabaseRefactorResponse = {
	status?: string;
	deleted_counts?: Record<string, number>;
};

type DashboardPage = "competitor-scout" | "posts-analysis" | "settings";

const DEFAULT_ALTITUT_CONTEXT =
	"Altitut is an AI-powered entrepreneurship platform for students and early-stage founders. It combines learning modules, customer discovery tooling, pitch practice, and progress tracking so users can validate ideas and build startup momentum in one place.";
const ALTITUT_CONTEXT_STORAGE_KEY = "altitut.dashboard.altitut-context.v1";
const ACTIVE_PAGE_STORAGE_KEY = "altitut.dashboard.active-page.v1";
const DASHBOARD_PAGES: Array<{
	id: DashboardPage;
	label: string;
	title: string;
	description: string;
}> = [
	{
		id: "competitor-scout",
		label: "Tool 1",
		title: "Competitor Scout",
		description: "Discover and review competitors using the Altitut context.",
	},
	{
		id: "posts-analysis",
		label: "Tool 2",
		title: "Posts Analysis",
		description: "Review social posts from approved competitors.",
	},
	{
		id: "settings",
		label: "Settings",
		title: "Altitut Context",
		description: "Edit the preloaded Altitut context used by the scout.",
	},
];

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const REVIEW_STORAGE_KEY = "altitut.dashboard.review-state.v1";

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

function getAnalysisSummary(analysis?: Record<string, unknown>): string {
	if (!analysis) {
		return "No analysis saved yet.";
	}
	const summary = analysis.summary;
	return typeof summary === "string" ? summary : "Analysis available.";
}

function statusTone(
	status?: string,
): "success" | "warning" | "danger" | "neutral" {
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

function renderRecordPreview(
	record?: Record<string, unknown>,
	maxEntries = 4,
): ReactNode {
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

function EmptyState({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: ReactNode;
}) {
	return (
		<div className="empty-state">
			<strong>{title}</strong>
			<p>{description}</p>
			{action ? <div className="empty-state-action">{action}</div> : null}
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
				<button
					type="button"
					onClick={onApprove}
					disabled={busyApprove || !canApprove}
				>
					{busyApprove ? "Saving..." : approveLabel}
				</button>
			) : null}
			{!isRejected ? (
				<button
					type="button"
					className="secondary danger"
					onClick={onReject}
					disabled={busyReject}
				>
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
	subtitle: ReactNode;
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

function clearStoredReviewState(): void {
	if (typeof window === "undefined") {
		return;
	}
	try {
		window.localStorage.removeItem(REVIEW_STORAGE_KEY);
	} catch {
		// Ignore storage failures.
	}
}

function readStoredAltitutContext(): string {
	if (typeof window === "undefined") {
		return DEFAULT_ALTITUT_CONTEXT;
	}
	try {
		const raw = window.localStorage.getItem(ALTITUT_CONTEXT_STORAGE_KEY);
		return raw?.trim().length ? raw : DEFAULT_ALTITUT_CONTEXT;
	} catch {
		return DEFAULT_ALTITUT_CONTEXT;
	}
}

function readStoredActivePage(): DashboardPage {
	if (typeof window === "undefined") {
		return "competitor-scout";
	}
	try {
		const raw = window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
		if (
			raw === "competitor-scout" ||
			raw === "posts-analysis" ||
			raw === "settings"
		) {
			return raw;
		}
	} catch {
		return "competitor-scout";
	}
	return "competitor-scout";
}

function renderCompetitorSubtitle(item: {
	id: string;
	website?: string | null;
}): ReactNode {
	return (
		<span className="subtitle-inline">
			<span>{item.id}</span>
			{item.website ? (
				<>
					<span aria-hidden="true">·</span>
					<a href={item.website} target="_blank" rel="noreferrer">
						{item.website}
					</a>
				</>
			) : null}
		</span>
	);
}

function App() {
	const [activePage, setActivePage] = useState<DashboardPage>(() =>
		readStoredActivePage(),
	);
	const [altitutContext, setAltitutContext] = useState<string>(() =>
		readStoredAltitutContext(),
	);
	const [competitors, setCompetitors] = useState<Competitor[]>([]);
	const [analysisResult, setAnalysisResult] = useState<ApiEnvelope<Post>>({});
	const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<string[]>(
		[],
	);
	const [retrievalMode, setRetrievalMode] = useState("recent");
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string>("");
	const [notice, setNotice] = useState<string>("");
	const [dashboardLoading, setDashboardLoading] = useState(true);
	const [lastScoutCandidateCount, setLastScoutCandidateCount] = useState<
		number | null
	>(null);
	const [reviewState, setReviewState] = useState<ReviewState>(() =>
		readStoredReviewState(),
	);

	useEffect(() => {
		try {
			if (
				Object.keys(reviewState.competitors).length === 0 &&
				Object.keys(reviewState.posts).length === 0
			) {
				window.localStorage.removeItem(REVIEW_STORAGE_KEY);
				return;
			}
			window.localStorage.setItem(
				REVIEW_STORAGE_KEY,
				JSON.stringify(reviewState),
			);
		} catch {
			// Ignore storage failures.
		}
	}, [reviewState]);

	useEffect(() => {
		try {
			window.localStorage.setItem(ALTITUT_CONTEXT_STORAGE_KEY, altitutContext);
		} catch {
			// Ignore storage failures.
		}
	}, [altitutContext]);

	useEffect(() => {
		try {
			window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activePage);
		} catch {
			// Ignore storage failures.
		}
	}, [activePage]);

	const loadDashboard = useCallback(
		async (options?: { preserveNotice?: boolean }) => {
			setDashboardLoading(true);
			setError("");
			if (!options?.preserveNotice) {
				setNotice("");
			}
			try {
				const competitorsRes = await fetchJson<Competitor[]>("/competitors");
				setCompetitors(competitorsRes);
				const approvedIds = competitorsRes
					.filter(
						(competitor) =>
							getReviewDecision(
								competitor,
								reviewState.competitors[competitor.id],
							) === "approved",
					)
					.map((competitor) => competitor.id);
				setSelectedCompetitorIds((current) => {
					const retained = current.filter((id) => approvedIds.includes(id));
					if (retained.length > 0 || current.length > 0) {
						return retained;
					}
					return approvedIds;
				});
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to load dashboard.",
				);
			} finally {
				setDashboardLoading(false);
			}
		},
		[reviewState],
	);

	useEffect(() => {
		void loadDashboard();
	}, [loadDashboard]);

	const activePageMeta =
		DASHBOARD_PAGES.find((page) => page.id === activePage) ??
		DASHBOARD_PAGES[0];
	const currentContext = altitutContext.trim() || DEFAULT_ALTITUT_CONTEXT;

	const competitorRows = useMemo(
		() =>
			competitors.map((competitor) => ({
				competitor,
				localDecision: reviewState.competitors[competitor.id],
				status: getReviewDecision(
					competitor,
					reviewState.competitors[competitor.id],
				),
			})),
		[competitors, reviewState],
	);

	const approvedCompetitors = useMemo(
		() =>
			competitorRows
				.filter((row) => row.status === "approved")
				.map((row) => row.competitor),
		[competitorRows],
	);

	const selectedApprovedCompetitors = approvedCompetitors.filter((competitor) =>
		selectedCompetitorIds.includes(competitor.id),
	);

	async function runCompetitorScout(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy("scout");
		setError("");
		setNotice("");
		try {
			const response = await fetchJson<ApiEnvelope<Competitor>>(
				"/competitor-scout",
				{
					method: "POST",
					body: JSON.stringify({
						altitut_context: currentContext,
						focus_keywords: [],
						notes: [],
					}),
				},
			);
			setLastScoutCandidateCount(
				response.candidate_count ?? response.candidates?.length ?? null,
			);
			setNotice("Competitor scout completed.");
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
				}),
			});
			setAnalysisResult(response);
			setNotice("Post analysis completed.");
			await loadDashboard({ preserveNotice: true });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Posts analysis failed.");
		} finally {
			setBusy(null);
		}
	}

	async function approveCompetitor(id: string) {
		setBusy(`approve-competitor-${id}`);
		setError("");
		setNotice("");
		try {
			await fetchJson(`/competitors/${id}/approve`, { method: "POST" });
			setReviewState((current) => ({
				...current,
				competitors: {
					...current.competitors,
					[id]: "approved",
				},
			}));
			setNotice("Competitor approved.");
			await loadDashboard({ preserveNotice: true });
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Unable to approve competitor.",
			);
		} finally {
			setBusy(null);
		}
	}

	async function rejectCompetitor(id: string) {
		setBusy(`reject-competitor-${id}`);
		setError("");
		setNotice("");
		try {
			await fetchJson(`/competitors/${id}/reject`, { method: "POST" });
			setReviewState((current) => {
				const { [id]: _removed, ...remainingCompetitors } = current.competitors;
				return {
					...current,
					competitors: remainingCompetitors,
				};
			});
			setCompetitors((current) =>
				current.filter((competitor) => competitor.id !== id),
			);
			setSelectedCompetitorIds((current) =>
				current.filter((competitorId) => competitorId !== id),
			);
			setNotice("Competitor removed.");
			await loadDashboard({ preserveNotice: true });
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Unable to dismiss competitor.",
			);
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
			setReviewState((current) => ({
				...current,
				posts: {
					...current.posts,
					[id]: "approved",
				},
			}));
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
			await fetchJson(`/posts/${id}/reject`, { method: "POST" });
			setReviewState((current) => ({
				...current,
				posts: {
					...current.posts,
					[id]: "rejected",
				},
			}));
			setNotice("Post dismissed.");
			await loadDashboard({ preserveNotice: true });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unable to dismiss post.");
		} finally {
			setBusy(null);
		}
	}

	async function refactorDatabase() {
		const confirmed = window.confirm(
			"This will permanently delete all competitors, posts, runs, workflow events, and saved review decisions in this browser. Continue?",
		);
		if (!confirmed) {
			return;
		}

		setBusy("database-refactor");
		setError("");
		setNotice("");
		try {
			const response = await fetchJson<DatabaseRefactorResponse>(
				"/database/refactor",
				{
					method: "POST",
				},
			);
			const counts = response.deleted_counts ?? {};
			const summary = Object.entries(counts)
				.map(([table, count]) => `${count} ${table}`)
				.join(", ");
			clearStoredReviewState();
			setReviewState({ competitors: {}, posts: {} });
			setCompetitors([]);
			setAnalysisResult({});
			setSelectedCompetitorIds([]);
			setLastScoutCandidateCount(null);
			setNotice(
				summary
					? `Database records deleted: ${summary}.`
					: "Database records deleted.",
			);
			await loadDashboard({ preserveNotice: true });
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Unable to refactor database.",
			);
		} finally {
			setBusy(null);
		}
	}

	function toggleCompetitorSelection(id: string) {
		setSelectedCompetitorIds((current) =>
			current.includes(id)
				? current.filter((item) => item !== id)
				: [...current, id],
		);
	}

	function resetAltitutContext() {
		setAltitutContext(DEFAULT_ALTITUT_CONTEXT);
		setNotice("Altitut context reset to the default value.");
	}

	const sidebarButtons = DASHBOARD_PAGES.map((page) => (
		<button
			key={page.id}
			type="button"
			className={`side-nav-link ${activePage === page.id ? "active" : ""}`}
			aria-current={activePage === page.id ? "page" : undefined}
			onClick={() => setActivePage(page.id)}
		>
			<span className="side-nav-link-label">{page.label}</span>
			<strong>{page.title}</strong>
			<span className="side-nav-link-description">{page.description}</span>
		</button>
	));

	return (
		<div className="app-shell">
			<aside className="side-nav">
				<div className="side-nav-brand">
					<p className="eyebrow">ALTITUT</p>
					<h1>Social media analysis</h1>
					<p className="lead">
						IBM / Carbon-inspired dashboard with a focused product workflow.
					</p>
				</div>
				<nav className="side-nav-menu" aria-label="Primary pages">
					{sidebarButtons}
				</nav>
				<div className="side-nav-meta">
					<p className="eyebrow">Context source</p>
					<strong>Settings override</strong>
					<p className="muted">
						The scout uses the saved Altitut context from Settings. If no
						override is provided, the backend falls back to its default context.
					</p>
				</div>
			</aside>

			<div className="app-content">
				<header className="page-header">
					<div>
						<p className="eyebrow">Enterprise social intelligence dashboard</p>
						<h2>{activePageMeta.title}</h2>
						<p className="lead">{activePageMeta.description}</p>
					</div>
					<section
						className="page-header-meta"
						aria-label="Live dashboard summary"
					>
						<span className="pill neutral">Live data</span>
						<span className="pill success">
							{dashboardLoading ? "Refreshing" : "Synchronized"}
						</span>
						<span className="pill neutral">
							{analysisResult.post_count ?? analysisResult.posts?.length ?? 0}{" "}
							analyzed posts
						</span>
					</section>
				</header>

				{error ? <div className="alert error">{error}</div> : null}
				{notice ? <div className="alert info">{notice}</div> : null}

				{activePage === "competitor-scout" ? (
					<main className="dashboard-stack">
						<section className="panel" id="competitor-scout">
							<div className="panel-heading">
								<div>
									<p className="eyebrow">Tool 1</p>
									<h2>Competitor Scout</h2>
								</div>
								<div className="inline-actions">
									<button
										type="button"
										className="secondary"
										onClick={() => void loadDashboard()}
									>
										{dashboardLoading ? "Loading..." : "Refresh data"}
									</button>
									<button
										type="button"
										className="danger-action"
										onClick={() => void refactorDatabase()}
										disabled={busy === "database-refactor" || dashboardLoading}
									>
										{busy === "database-refactor"
											? "Deleting..."
											: "Refactor Database"}
									</button>
								</div>
							</div>

							<form className="stack" onSubmit={runCompetitorScout}>
								<p className="muted">
									The scout uses the Altitut context saved in Settings and sends
									it to the LLM pipeline.
								</p>
								<div className="inline-hint">
									<span className="pill neutral">Context active</span>
									<span className="muted">
										{currentContext.slice(0, 140)}
										{currentContext.length > 140 ? "…" : ""}
									</span>
								</div>
								<button
									type="submit"
									disabled={busy === "scout" || dashboardLoading}
								>
									{busy === "scout"
										? "Running scout..."
										: "Run competitor scout"}
								</button>
								{lastScoutCandidateCount !== null ? (
									<div
										className="inline-hint scout-result-count"
										aria-live="polite"
									>
										<span className="pill neutral">Latest scout result</span>
										<span className="muted">
											{lastScoutCandidateCount} competitor
											{lastScoutCandidateCount === 1 ? "" : "s"} returned.
										</span>
									</div>
								) : null}
							</form>

							<div className="cards">
								{dashboardLoading ? (
									<div className="loading-stack">
										<div className="card skeleton" />
										<div className="card skeleton" />
									</div>
								) : competitorRows.length ? (
									competitorRows.map(
										({ competitor, status, localDecision }) => (
											<ActionCard
												key={competitor.id}
												title={competitor.name}
												subtitle={renderCompetitorSubtitle(competitor)}
												status={status}
												statusLabel={
													status === "approved"
														? "Approved"
														: status === "rejected"
															? "Dismissed"
															: "Pending review"
												}
												headerRight={
													<span className="muted">
														{competitor.social_links
															? Object.keys(competitor.social_links).length
															: 0}{" "}
														social link(s)
													</span>
												}
												footer={
													<ReviewControls
														status={status}
														approveLabel={
															status === "approved"
																? "Approved"
																: status === "rejected"
																	? "Restore"
																	: "Approve"
														}
														rejectLabel={
															status === "rejected" ? "Dismissed" : "Dismiss"
														}
														onApprove={() =>
															void approveCompetitor(competitor.id)
														}
														onReject={() =>
															void rejectCompetitor(competitor.id)
														}
														busyApprove={
															busy === `approve-competitor-${competitor.id}`
														}
														busyReject={
															busy === `reject-competitor-${competitor.id}`
														}
														canApprove={
															status !== "approved" ||
															localDecision === "rejected"
														}
													/>
												}
											>
												<p>
													{competitor.relevance_summary ??
														"No relevance summary yet."}
												</p>
												<p className="muted">
													{competitor.traction_summary ??
														"No traction summary yet."}
												</p>
												{competitor.social_links &&
												Object.keys(competitor.social_links).length ? (
													<div className="link-cloud">
														{Object.entries(competitor.social_links).map(
															([platform, url]) => (
																<a
																	key={platform}
																	href={url}
																	target="_blank"
																	rel="noreferrer"
																>
																	{platform}
																</a>
															),
														)}
													</div>
												) : null}
											</ActionCard>
										),
									)
								) : (
									<EmptyState
										title="No competitors saved yet"
										description="Run the scout and approve competitors before analysis can use them."
										action={
											<span className="pill neutral">
												Approve candidates to unlock posts analysis
											</span>
										}
									/>
								)}
							</div>
						</section>
					</main>
				) : null}

				{activePage === "posts-analysis" ? (
					<main className="dashboard-stack">
						<section className="panel" id="posts-analysis">
							<div className="panel-heading">
								<div>
									<p className="eyebrow">Tool 2</p>
									<h2>Posts Analysis</h2>
								</div>
							</div>

							<form className="stack" onSubmit={runPostsAnalysis}>
								<div className="grid two-up">
									<label className="field">
										Retrieval mode
										<select
											value={retrievalMode}
											onChange={(event) => setRetrievalMode(event.target.value)}
										>
											<option value="recent">Most Recent Posts</option>
											<option value="popular">Most Popular Posts</option>
										</select>
									</label>
									<div className="stack">
										<span className="field-label">
											Approved competitors to analyze
										</span>
										<div className="selector-grid">
											{approvedCompetitors.map((competitor) => (
												<label className="checkbox-card" key={competitor.id}>
													<input
														type="checkbox"
														checked={selectedCompetitorIds.includes(
															competitor.id,
														)}
														onChange={() =>
															toggleCompetitorSelection(competitor.id)
														}
													/>
													<span>{competitor.name}</span>
												</label>
											))}
											{!approvedCompetitors.length ? (
												<p className="muted">
													Approve competitors first to enable posts analysis.
												</p>
											) : null}
										</div>
										<div className="inline-hint">
											<span className="muted">
												{selectedApprovedCompetitors.length
													? `${selectedApprovedCompetitors.length} approved competitor(s) selected.`
													: "Select at least one approved competitor to run analysis."}
											</span>
										</div>
									</div>
								</div>

								<button
									type="submit"
									disabled={
										busy === "posts" ||
										!selectedCompetitorIds.length ||
										dashboardLoading
									}
								>
									{busy === "posts" ? "Analyzing posts..." : "Analyze posts"}
								</button>
							</form>

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
												statusLabel={
													status === "approved"
														? "Approved"
														: status === "rejected"
															? "Dismissed"
															: "Pending review"
												}
												headerRight={
													<span className="muted">{post.retrieval_mode}</span>
												}
												footer={
													<ReviewControls
														status={status}
														approveLabel={
															status === "approved"
																? "Approved"
																: status === "rejected"
																	? "Restore"
																	: "Approve"
														}
														rejectLabel={
															status === "rejected" ? "Dismissed" : "Dismiss"
														}
														onApprove={() => void approvePost(post.id)}
														onReject={() => void rejectPost(post.id)}
														busyApprove={busy === `approve-post-${post.id}`}
														busyReject={busy === `reject-post-${post.id}`}
														canApprove={
															status !== "approved" ||
															localDecision === "rejected"
														}
													/>
												}
											>
												<p>{getAnalysisSummary(post.analysis)}</p>
												<p className="muted">
													{post.caption ?? "No caption captured."}
												</p>
												{post.source_url ? (
													<a
														href={post.source_url}
														target="_blank"
														rel="noreferrer"
													>
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
										description="Run analysis on approved competitors to populate the latest results. Each returned post can be approved or dismissed individually."
									/>
								)}
							</div>
						</section>
					</main>
				) : null}

				{activePage === "settings" ? (
					<main className="dashboard-stack">
						<section className="panel settings-panel" id="settings">
							<div className="panel-heading">
								<div>
									<p className="eyebrow">Settings</p>
									<h2>Altitut context</h2>
								</div>
								<button
									type="button"
									className="secondary"
									onClick={resetAltitutContext}
								>
									Reset to default
								</button>
							</div>

							<label className="field field--textarea">
								Altitut context
								<textarea
									rows={12}
									value={altitutContext}
									onChange={(event) => setAltitutContext(event.target.value)}
									placeholder={DEFAULT_ALTITUT_CONTEXT}
								/>
							</label>

							<div className="settings-meta">
								<p className="muted">
									This value is preloaded from the backend default and saved
									locally in this browser. The scout sends it with every run.
								</p>
								<p className="muted">
									Current length: {currentContext.length} characters.
								</p>
							</div>
						</section>
					</main>
				) : null}
			</div>
		</div>
	);
}

export { App };
