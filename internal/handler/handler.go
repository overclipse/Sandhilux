package handler

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"overclipse/Sandhilux/internal/service/checker"
)

// Handler holds all application dependencies.
type Handler struct {
	PG          *pgxpool.Pool        // PostgreSQL — users, endpoints, alerts, settings, check_records
	Checker     *checker.Checker     // фоновый чекер — для ручных проверок
	Broadcaster *checker.Broadcaster // рассылка событий SSE клиентам
}

// New creates a Handler.
func New(pg *pgxpool.Pool, chk *checker.Checker, bc *checker.Broadcaster) *Handler {
	return &Handler{PG: pg, Checker: chk, Broadcaster: bc}
}
