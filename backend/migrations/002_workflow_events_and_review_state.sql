ALTER TABLE competitors
    ADD COLUMN IF NOT EXISTS rejected BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_competitors_rejected ON competitors (rejected);
CREATE INDEX IF NOT EXISTS idx_competitors_reviewed_at ON competitors (reviewed_at);

ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS rejected BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_posts_rejected ON posts (rejected);
CREATE INDEX IF NOT EXISTS idx_posts_reviewed_at ON posts (reviewed_at);

ALTER TABLE workflow_events
    ADD COLUMN IF NOT EXISTS actor TEXT NOT NULL DEFAULT 'system',
    ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'completed',
    ADD COLUMN IF NOT EXISTS provider TEXT,
    ADD COLUMN IF NOT EXISTS source_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_workflow_events_entity ON workflow_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_action ON workflow_events (action);
CREATE INDEX IF NOT EXISTS idx_workflow_events_outcome ON workflow_events (outcome);
CREATE INDEX IF NOT EXISTS idx_workflow_events_run_id ON workflow_events (run_id);
