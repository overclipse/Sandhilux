package app

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"overclipse/Sandhilux/internal/database"
	"overclipse/Sandhilux/internal/handler"
	"overclipse/Sandhilux/internal/router"
	"overclipse/Sandhilux/internal/service/checker"
)

func Run(addr string) error {
	ctx := context.Background()

	// ── Startup validation ────────────────────────────
	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("FATAL: JWT_SECRET environment variable is required")
	}
	if os.Getenv("DATABASE_URL") == "" {
		log.Fatal("FATAL: DATABASE_URL environment variable is required")
	}

	// ── PostgreSQL ────────────────────────────────────
	pg, err := database.ConnectPostgres(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pg.Close()
	log.Println("connected to PostgreSQL")

	if err := database.MigratePostgres(ctx, pg); err != nil {
		return err
	}
	log.Println("PostgreSQL migrations applied")

	// ── Checker + Broadcaster ─────────────────────────
	chk := checker.New(pg)
	bc := checker.NewBroadcaster(chk.Events)

	checkerCtx, checkerCancel := context.WithCancel(ctx)
	defer checkerCancel()

	go chk.Run(checkerCtx) // пишет результаты в chk.Events
	go bc.Run(checkerCtx)  // читает из chk.Events, рассылает SSE клиентам

	// ── HTTP server ───────────────────────────────────
	h := handler.New(pg, chk, bc)
	srv := &http.Server{
		Addr:         addr,
		Handler:      router.New(h),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("HTTP server listening on %s", addr)
		if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	// ── Graceful shutdown ─────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		return err
	case sig := <-quit:
		log.Printf("received %v, shutting down...", sig)
	}

	checkerCancel()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return srv.Shutdown(shutdownCtx)
}
