import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./app";

const originalFetch = globalThis.fetch;

afterEach(() => {
	cleanup();
	localStorage.clear();
	globalThis.fetch = originalFetch;
});

beforeEach(() => {
	localStorage.clear();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		headers: {
			"Content-Type": "application/json",
			...(init.headers ?? {}),
		},
	});
}

function installDashboardFetch(options: {
	competitors: Record<string, unknown>[];
	posts: Record<string, unknown>[];
	analysisPosts?: Record<string, unknown>[];
	scoutResultCount?: number;
}) {
	const {
		competitors,
		posts,
		analysisPosts = [],
		scoutResultCount = competitors.length,
	} = options;
	const currentCompetitors = [...competitors];
	const currentPosts = [...posts];
	const requests: Array<{ url: string; method: string; body?: unknown }> = [];
	const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const method = init?.method ?? "GET";
		let body: unknown;
		if (typeof init?.body === "string") {
			try {
				body = JSON.parse(init.body);
			} catch {
				body = init.body;
			}
		}
		requests.push({ url, method, body });

		if (url.endsWith("/health")) {
			return jsonResponse({
				status: "ok",
				service: "ALTITUT Social Media Analysis API",
				version: "0.1.0",
			});
		}
		if (url.endsWith("/integrations/apify/status")) {
			return jsonResponse({
				provider: "apify",
				ready: true,
				status: "ready",
				missing_requirements: [],
				next_steps: [],
				docs_url: "https://docs.apify.com/",
				details: { config: { actor_id: "apify/instagram-profile-scraper" } },
			});
		}
		if (url.endsWith("/integrations/llm/status")) {
			return jsonResponse({
				provider: "openai-compatible",
				ready: true,
				status: "ready",
				missing_requirements: [],
				next_steps: [],
				docs_url: "https://platform.openai.com/docs",
				details: {
					config: {
						model: "gpt-4.1-mini",
						base_url: "https://api.openai.com/v1",
					},
					mode: "remote",
				},
			});
		}
		if (url.endsWith("/competitors") && method === "GET") {
			return jsonResponse(currentCompetitors);
		}
		if (url.includes("/posts?approved=true") && method === "GET") {
			return jsonResponse(currentPosts);
		}
		if (url.endsWith("/competitor-scout") && method === "POST") {
			return jsonResponse({
				status: "completed",
				candidate_count: scoutResultCount,
				candidates: competitors,
			});
		}
		if (url.endsWith("/posts-analyze") && method === "POST") {
			return jsonResponse({
				status: "completed",
				post_count: analysisPosts.length,
				posts: analysisPosts,
			});
		}
		if (url.endsWith("/approve") && method === "POST") {
			return jsonResponse({ ok: true });
		}
		if (url.endsWith("/reject") && method === "POST") {
			const match = url.match(/\/competitors\/([^/]+)\/reject$/);
			if (match) {
				const competitorId = decodeURIComponent(match[1]);
				const index = currentCompetitors.findIndex(
					(competitor) => competitor.id === competitorId,
				);
				if (index !== -1) {
					const [removed] = currentCompetitors.splice(index, 1);
					return jsonResponse({ ok: true, deleted: removed });
				}
			}
			return jsonResponse({ ok: true });
		}
		if (url.endsWith("/database/refactor") && method === "POST") {
			currentCompetitors.length = 0;
			currentPosts.length = 0;
			return jsonResponse({
				status: "completed",
				deleted_counts: {
					workflow_events: 4,
					runs: 3,
					posts: 2,
					competitors: 1,
				},
			});
		}

		throw new Error(`Unexpected request: ${method} ${url}`);
	};

	globalThis.fetch = fetchMock as typeof fetch;
	return { requests };
}

function waitForDashboard() {
	return waitFor(() => {
		expect(
			screen.getByRole("navigation", { name: "Primary pages" }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Run competitor scout" }),
		).toBeTruthy();
	});
}

describe("dashboard states", () => {
	it("renders the side-nav with three pages and the competitor scout default view", async () => {
		installDashboardFetch({
			competitors: [],
			posts: [],
		});

		render(<App />);

		await waitForDashboard();

		expect(
			screen.getByRole("navigation", { name: "Primary pages" }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: /Tool 1/ })).toBeTruthy();
		expect(screen.getByRole("button", { name: /Tool 2/ })).toBeTruthy();
		expect(screen.getByRole("button", { name: /Settings/ })).toBeTruthy();
		expect(
			screen.getByText("Enterprise social intelligence dashboard"),
		).toBeTruthy();
		expect(
			screen.getAllByRole("heading", { name: "Competitor Scout" }).length,
		).toBeGreaterThan(0);
	});

	it("shows a destructive Refactor Database button that clears all records after confirmation", async () => {
		const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

		installDashboardFetch({
			competitors: [
				{
					id: "memory-target",
					name: "Memory Target",
					website: "https://example.com",
					social_links: {
						linkedin: "https://linkedin.com/company/memory-target",
					},
					relevance_summary: "Relevant competitor",
					traction_summary: "Consistent traction",
					approved: false,
					rejected: false,
					source_run_id: "run-memory",
				},
			],
			posts: [],
		});

		render(<App />);

		await waitForDashboard();

		const button = screen.getByRole("button", { name: "Refactor Database" });
		expect(button).toBeTruthy();

		fireEvent.click(button);

		await waitFor(() => {
			expect(screen.getByText(/Database records deleted:/)).toBeTruthy();
			expect(screen.getByText("No competitors saved yet")).toBeTruthy();
		});

		expect(confirmSpy).toHaveBeenCalledWith(
			"This will permanently delete all competitors, posts, runs, workflow events, and saved review decisions in this browser. Continue?",
		);
		expect(
			window.localStorage.getItem("altitut.dashboard.review-state.v1"),
		).toBeNull();
		confirmSpy.mockRestore();
	});

	it("removes a dismissed competitor completely from the dashboard and local memory", async () => {
		const dashboard = installDashboardFetch({
			competitors: [
				{
					id: "dismiss-me",
					name: "Dismiss Me",
					website: "https://dismiss.example.com",
					social_links: { linkedin: "https://linkedin.com/company/dismiss-me" },
					relevance_summary: "Relevant competitor",
					traction_summary: "Consistent traction",
					approved: false,
					rejected: false,
					source_run_id: "run-dismiss",
				},
			],
			posts: [],
		});
		window.localStorage.setItem(
			"altitut.dashboard.review-state.v1",
			JSON.stringify({ competitors: { "dismiss-me": "approved" }, posts: {} }),
		);

		render(<App />);
		await waitForDashboard();

		expect(screen.getByText("Approved")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

		await waitFor(() => {
			expect(screen.queryByText("Dismiss Me")).toBeNull();
			expect(screen.getByText("No competitors saved yet")).toBeTruthy();
		});

		expect(
			window.localStorage.getItem("altitut.dashboard.review-state.v1"),
		).toBeNull();
		const rejectRequest = dashboard.requests.find(
			(request) => request.url.endsWith("/reject") && request.method === "POST",
		);
		expect(rejectRequest).toBeTruthy();
	});

	it("shows the competitor count directly under the scout button after the run completes", async () => {
		installDashboardFetch({
			competitors: [],
			posts: [],
			scoutResultCount: 2,
		});

		render(<App />);
		await waitForDashboard();

		fireEvent.click(
			screen.getByRole("button", { name: "Run competitor scout" }),
		);

		await waitFor(() => {
			expect(screen.getByText("2 competitors returned.")).toBeTruthy();
		});
	});

	it("clears saved review decisions when the database is refactored", async () => {
		const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
		window.localStorage.setItem(
			"altitut.dashboard.review-state.v1",
			JSON.stringify({
				competitors: { "memory-target": "approved" },
				posts: {},
			}),
		);

		installDashboardFetch({
			competitors: [
				{
					id: "memory-target",
					name: "Memory Target",
					website: "https://example.com",
					social_links: {
						linkedin: "https://linkedin.com/company/memory-target",
					},
					relevance_summary: "Relevant competitor",
					traction_summary: "Consistent traction",
					approved: false,
					rejected: false,
					source_run_id: "run-memory",
				},
			],
			posts: [],
		});

		render(<App />);
		await waitForDashboard();

		fireEvent.click(screen.getByRole("button", { name: "Refactor Database" }));

		await waitFor(() => {
			expect(screen.getByText(/Database records deleted:/)).toBeTruthy();
			expect(screen.getByText("No competitors saved yet")).toBeTruthy();
		});

		expect(
			window.localStorage.getItem("altitut.dashboard.review-state.v1"),
		).toBeNull();
		expect(confirmSpy).toHaveBeenCalled();
		confirmSpy.mockRestore();
	});

	it("lets settings override the Altitut context used by competitor scout", async () => {
		const dashboard = installDashboardFetch({
			competitors: [],
			posts: [],
		});

		render(<App />);
		await waitForDashboard();

		fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
		const textarea = await screen.findByLabelText("Altitut context");
		fireEvent.change(textarea, {
			target: { value: "Custom Altitut context for UC Davis founders." },
		});

		fireEvent.click(screen.getByRole("button", { name: /Tool 1/ }));
		await waitForDashboard();

		fireEvent.click(
			screen.getByRole("button", { name: "Run competitor scout" }),
		);

		await waitFor(() => {
			const scoutRequest = dashboard.requests.find(
				(request) =>
					request.url.endsWith("/competitor-scout") &&
					request.method === "POST",
			);
			expect(scoutRequest).toBeTruthy();
			expect(scoutRequest?.body).toEqual(
				expect.objectContaining({
					altitut_context: "Custom Altitut context for UC Davis founders.",
				}),
			);
		});
	});

	it("runs post analysis from approved competitors and shows returned post cards", async () => {
		installDashboardFetch({
			competitors: [
				{
					id: "competitor-1",
					name: "Post Target",
					website: "https://example.com",
					social_links: { instagram: "https://instagram.com/posttarget" },
					relevance_summary: "Relevant competitor",
					traction_summary: "Consistent traction",
					approved: true,
					rejected: false,
					source_run_id: "run-1",
				},
			],
			posts: [],
			analysisPosts: [
				{
					id: "post-1",
					competitor_id: "competitor-1",
					competitor_name: "Post Target",
					source_platform: "instagram",
					source_url: "https://instagram.com/p/post-1",
					retrieval_mode: "recent",
					title: "Unique Post",
					caption: "Caption text",
					traction: { likesCount: 99 },
					analysis: { summary: "Great hook" },
					approved: false,
					rejected: false,
					source_run_id: "run-post-1",
				},
			],
		});

		render(<App />);
		await waitForDashboard();

		fireEvent.click(screen.getByRole("button", { name: /Tool 2/ }));
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Analyze posts" }),
			).toBeTruthy();
		});

		fireEvent.click(screen.getByRole("button", { name: "Analyze posts" }));

		const postCard = await screen
			.findByText("Unique Post · instagram", { selector: "p" })
			.then((element) => element.closest("details"));
		expect(postCard).not.toBeNull();
		if (!postCard) {
			throw new Error("Post card not found");
		}

		fireEvent.click(
			within(postCard).getByRole("button", { name: "Approve", hidden: true }),
		);

		await waitFor(() => {
			expect(screen.getByText("Post approved.")).toBeTruthy();
		});

		expect(
			screen.getByRole("navigation", { name: "Primary pages" }),
		).toBeTruthy();
	});
});
