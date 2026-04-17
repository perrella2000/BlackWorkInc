package database

import (
	"context"
	"log"
)

// RunMigrations creates all tables if they don't exist.
// Safe to run on every startup (idempotent).
func RunMigrations() {
	queries := []string{
		`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,

		`CREATE TABLE IF NOT EXISTS users (
			id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			phone        VARCHAR(20) UNIQUE NOT NULL,
			role         VARCHAR(20) NOT NULL DEFAULT 'worker',
			name         VARCHAR(255) NOT NULL DEFAULT '',
			company_name VARCHAR(255) NOT NULL DEFAULT '',
			city         VARCHAR(255) NOT NULL DEFAULT '',
			skills       JSONB        NOT NULL DEFAULT '[]',
			avatar_emoji VARCHAR(10)  NOT NULL DEFAULT '👤',
			language     VARCHAR(5)   NOT NULL DEFAULT 'ru',
			rating       NUMERIC(3,2) NOT NULL DEFAULT 5.00,
			created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,

		`CREATE TABLE IF NOT EXISTS jobs (
			id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			employer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			title        VARCHAR(255) NOT NULL,
			icon         VARCHAR(10)  NOT NULL DEFAULT '💼',
			salary       VARCHAR(100) NOT NULL,
			description  TEXT         NOT NULL DEFAULT '',
			skills       JSONB        NOT NULL DEFAULT '[]',
			status       VARCHAR(20)  NOT NULL DEFAULT 'active',
			rating       NUMERIC(3,2) NOT NULL DEFAULT 5.00,
			created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,

		`CREATE TABLE IF NOT EXISTS job_matches (
			job_id    UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
			worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			status    VARCHAR(20) NOT NULL DEFAULT 'liked',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (job_id, worker_id)
		)`,

		`CREATE TABLE IF NOT EXISTS conversations (
			id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
			employer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			worker_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,

		`CREATE TABLE IF NOT EXISTS messages (
			id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
			sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			text_content    TEXT NOT NULL DEFAULT '',
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,

		`CREATE TABLE IF NOT EXISTS reviews (
			id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
			comment     TEXT NOT NULL DEFAULT '',
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,

		// Indices for common queries
		`CREATE INDEX IF NOT EXISTS idx_jobs_employer ON jobs(employer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_matches_worker ON job_matches(worker_id)`,
		`CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_unique ON conversations(job_id, employer_id, worker_id)`,

		// Migration tasks for existing data
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(255) NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]'`,
	}

	for _, q := range queries {
		if _, err := DB.Exec(context.Background(), q); err != nil {
			log.Fatalf("Migration failed: %v\nQuery: %s", err, q)
		}
	}
	log.Println("✅ DB migrations applied")
}
