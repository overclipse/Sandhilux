package database

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/001_init.sql
var pgMigration string

// MigratePostgres runs the PostgreSQL schema migration.
func MigratePostgres(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, pgMigration); err != nil {
		return fmt.Errorf("postgres migration: %w", err)
	}
	return nil
}
