CREATE TABLE IF NOT EXISTS competitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    website TEXT,
    social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
    relevance_summary TEXT NOT NULL,
    traction_summary TEXT NOT NULL,
    approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    source_run_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitors_approved ON competitors (approved);
CREATE INDEX IF NOT EXISTS idx_competitors_name ON competitors (name);

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    source_platform TEXT NOT NULL,
    source_url TEXT,
    retrieval_mode TEXT NOT NULL,
    title TEXT,
    caption TEXT,
    transcript TEXT,
    frames JSONB NOT NULL DEFAULT '[]'::jsonb,
    traction JSONB NOT NULL DEFAULT '{}'::jsonb,
    analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
    approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    source_run_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_competitor_id ON posts (competitor_id);
CREATE INDEX IF NOT EXISTS idx_posts_approved ON posts (approved);
CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts (source_platform);

CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    run_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    input JSONB NOT NULL DEFAULT '{}'::jsonb,
    output JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runs_type ON runs (run_type);
CREATE INDEX IF NOT EXISTS idx_runs_provider ON runs (provider);
