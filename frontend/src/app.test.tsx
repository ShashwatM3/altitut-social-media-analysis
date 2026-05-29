import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './app';

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
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function installDashboardFetch(options: {
  apifyStatus: Record<string, unknown>;
  llmStatus: Record<string, unknown>;
  competitors: Record<string, unknown>[];
  posts: Record<string, unknown>[];
  analysisPosts?: Record<string, unknown>[];
}) {
  const { apifyStatus, llmStatus, competitors, posts, analysisPosts = [] } = options;
  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url.endsWith('/health')) {
      return jsonResponse({ status: 'ok', service: 'ALTITUT Social Media Analysis API', version: '0.1.0' });
    }
    if (url.endsWith('/integrations/apify/status')) {
      return jsonResponse(apifyStatus);
    }
    if (url.endsWith('/integrations/llm/status')) {
      return jsonResponse(llmStatus);
    }
    if (url.endsWith('/competitors') && method === 'GET') {
      return jsonResponse(competitors);
    }
    if (url.endsWith('/posts?approved=true') && method === 'GET') {
      return jsonResponse(posts);
    }
    if (url.endsWith('/posts-analyze') && method === 'POST') {
      return jsonResponse({ status: 'completed', post_count: analysisPosts.length, posts: analysisPosts });
    }
    if (url.endsWith('/approve') && method === 'POST') {
      return jsonResponse({ ok: true });
    }
    if (url.endsWith('/reject') && method === 'POST') {
      return jsonResponse({ ok: true });
    }
    if (url.endsWith('/dismiss') && method === 'POST') {
      return jsonResponse({ ok: true });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  globalThis.fetch = fetchMock as typeof fetch;
}

function waitForDashboard() {
  return waitFor(() => {
    expect(screen.getByText('Competitor scout + posts analysis dashboard')).toBeTruthy();
    expect(screen.getByText('Backend')).toBeTruthy();
  });
}

describe('dashboard states', () => {
  it('shows integration setup states and keeps posts analysis disabled when nothing is selected', async () => {
    installDashboardFetch({
      apifyStatus: {
        provider: 'apify',
        ready: false,
        status: 'setup_required',
        missing_requirements: ['APIFY_TOKEN', 'provider.actor_id'],
        next_steps: ['Set APIFY_TOKEN in your environment.'],
        docs_url: 'https://docs.apify.com/',
        details: { config: { actor_id: '' } },
      },
      llmStatus: {
        provider: 'openai-compatible',
        ready: false,
        status: 'setup_required',
        missing_requirements: ['OPENAI_API_KEY', 'provider.model'],
        next_steps: [
          'Set OPENAI_API_KEY in your environment.',
          'Choose a compatible chat model and set provider.model.',
        ],
        docs_url: 'https://platform.openai.com/docs',
        details: { config: { model: '', offline_fallback: false }, mode: 'setup_required' },
      },
      competitors: [],
      posts: [],
    });

    render(<App />);

    await waitForDashboard();
    await waitFor(() => {
      expect(screen.getByText('LLM integration needs setup')).toBeTruthy();
    });

    expect(screen.getByText('Apify setup required')).toBeTruthy();
    expect(screen.getAllByText('LLM setup required').length).toBeGreaterThan(0);
    expect(screen.getByText('Apify setup required before scouting')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Analyze posts' }).disabled).toBe(true);
  });

  it('dismisses a competitor through the review controls and persists the local rejected state', async () => {
    installDashboardFetch({
      apifyStatus: {
        provider: 'apify',
        ready: true,
        status: 'ready',
        missing_requirements: [],
        next_steps: [],
        docs_url: 'https://docs.apify.com/',
        details: { config: { actor_id: 'apify/instagram-profile-scraper' } },
      },
      llmStatus: {
        provider: 'offline-heuristic',
        ready: true,
        status: 'ready',
        missing_requirements: [],
        next_steps: [],
        docs_url: 'https://platform.openai.com/docs',
        details: { config: { model: 'offline-heuristic-v1', offline_fallback: true }, mode: 'offline' },
      },
      competitors: [
        {
          id: 'competitor-1',
          name: 'Review Target',
          website: 'https://example.com',
          social_links: { instagram: 'https://instagram.com/reviewtarget' },
          relevance_summary: 'Relevant competitor',
          traction_summary: 'Consistent traction',
          approved: true,
          rejected: false,
          source_run_id: 'run-1',
        },
      ],
      posts: [],
    });

    render(<App />);
    await waitForDashboard();
    const competitorCard = screen.getByText('competitor-1 · https://example.com', { selector: 'p' }).closest('details');
    expect(competitorCard).not.toBeNull();
    if (!competitorCard) {
      throw new Error('Competitor card not found');
    }

    fireEvent.click(within(competitorCard).getByRole('button', { name: 'Dismiss', hidden: true }));

    await waitFor(() => {
      expect(screen.getByText('Competitor dismissed.')).toBeTruthy();
    });

    const refreshedCard = screen.getByText('competitor-1 · https://example.com', { selector: 'p' }).closest('details');
    expect(refreshedCard).not.toBeNull();
    if (!refreshedCard) {
      throw new Error('Competitor card did not rerender');
    }

    expect(within(refreshedCard).getByRole('button', { name: 'Restore', hidden: true })).toBeTruthy();
    expect(screen.getByText('Competitor dismissed.')).toBeTruthy();
  });

  it('approves an analyzed post and keeps the review state visible after reload', async () => {
    installDashboardFetch({
      apifyStatus: {
        provider: 'apify',
        ready: true,
        status: 'ready',
        missing_requirements: [],
        next_steps: [],
        docs_url: 'https://docs.apify.com/',
        details: { config: { actor_id: 'apify/instagram-profile-scraper' } },
      },
      llmStatus: {
        provider: 'offline-heuristic',
        ready: true,
        status: 'ready',
        missing_requirements: [],
        next_steps: [],
        docs_url: 'https://platform.openai.com/docs',
        details: { config: { model: 'offline-heuristic-v1', offline_fallback: true }, mode: 'offline' },
      },
      competitors: [
        {
          id: 'competitor-1',
          name: 'Post Target',
          website: 'https://example.com',
          social_links: { instagram: 'https://instagram.com/posttarget' },
          relevance_summary: 'Relevant competitor',
          traction_summary: 'Consistent traction',
          approved: true,
          rejected: false,
          source_run_id: 'run-1',
        },
      ],
      posts: [],
      analysisPosts: [
        {
          id: 'post-1',
          competitor_id: 'competitor-1',
          competitor_name: 'Post Target',
          source_platform: 'instagram',
          source_url: 'https://instagram.com/p/post-1',
          retrieval_mode: 'recent',
          title: 'Unique Post',
          caption: 'Caption text',
          traction: { likesCount: 99 },
          analysis: { summary: 'Great hook' },
          approved: false,
          rejected: false,
          source_run_id: 'run-post-1',
        },
      ],
    });

    render(<App />);
    await waitForDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'Analyze posts' }));

    const postCard = await screen.findByText('Unique Post · instagram', { selector: 'p' }).then((element) => element.closest('details'));
    expect(postCard).not.toBeNull();
    if (!postCard) {
      throw new Error('Post card not found');
    }

    fireEvent.click(within(postCard).getByRole('button', { name: 'Approve', hidden: true }));

    await waitFor(() => {
      expect(screen.getByText('Post approved.')).toBeTruthy();
    });

    const refreshedCard = screen.getByText('Unique Post · instagram', { selector: 'p' }).closest('details');
    expect(refreshedCard).not.toBeNull();
    if (!refreshedCard) {
      throw new Error('Post card did not rerender');
    }

    expect(within(refreshedCard).getByRole('button', { name: 'Dismiss', hidden: true })).toBeTruthy();
    expect(screen.getByText('Post approved.')).toBeTruthy();
  });
});
