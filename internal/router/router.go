package router

import (
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"overclipse/Sandhilux/internal/handler"
	"overclipse/Sandhilux/internal/middleware"
)

func New(h *handler.Handler) http.Handler {
	r := chi.NewRouter()

	// ── Global middleware ─────────────────────────────────
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(middleware.Security)
	r.Use(middleware.CORS)

	// ── API ───────────────────────────────────────────────
	r.Route("/api", func(r chi.Router) {

		// Auth — public, rate-limited
		r.Route("/auth", func(r chi.Router) {
			r.Use(middleware.RateLimit(10, 1*time.Minute))
			r.Get("/status", h.AuthStatus)
			r.Post("/login", h.Login)
			r.Post("/register", h.Register)
			r.Post("/setup", h.Setup)
			r.Post("/logout", h.Logout)
		})

		// Profile — reads JWT itself
		r.Get("/me", h.Me)

		// Protected routes — require valid JWT
		r.Group(func(r chi.Router) {
			r.Use(handler.Auth)

			// SSE stream — requires auth
			r.Get("/events", h.Events)

			// Quick URL probe — GET /api/probe?url=https://example.com
			r.Get("/probe", h.ProbeURL)

			r.Route("/endpoints", func(r chi.Router) {
				r.Get("/", h.ListEndpoints)
				r.Post("/", h.CreateEndpoint)

				r.Route("/{id}", func(r chi.Router) {
					r.Get("/", h.GetEndpoint)
					r.Put("/", h.UpdateEndpoint)
					r.Delete("/", h.DeleteEndpoint)
					r.Patch("/toggle", h.ToggleEndpoint)

					r.Post("/check", h.CheckEndpointNow)

					r.Get("/rules", h.ListRules)
					r.Post("/rules", h.CreateRule)
					r.Delete("/rules/{ruleID}", h.DeleteRule)

					r.Get("/history", h.GetHistory)
					r.Get("/stats", h.GetStats)
				})
			})

			r.Route("/metrics", func(r chi.Router) {
				r.Get("/overview", h.GetOverview)
				r.Get("/latency", h.GetDashboardLatency)
				r.Get("/uptime", h.GetDashboardUptime)
				r.Get("/worst", h.GetWorstEndpoints)
				r.Get("/incidents", h.GetRecentIncidents)
				r.Get("/{id}", h.GetEndpointLatency)
				r.Get("/{id}/uptime", h.GetEndpointUptime)
				r.Get("/{id}/timeline", h.GetEndpointTimeline)
			})

			r.Route("/alerts", func(r chi.Router) {
				r.Get("/", h.ListAlerts)
				r.Put("/{id}/resolve", h.ResolveAlert)
			})

			// Version info — any authenticated user
			r.Get("/version", h.GetVersion)

			// Settings — admin only
			r.Route("/settings", func(r chi.Router) {
				r.Use(handler.AdminOnly)

				r.Get("/users", h.ListUsers)
				r.Put("/users/{id}/role", h.UpdateUserRole)
				r.Delete("/users/{id}", h.RemoveUser)

				})
		})
	})

	// ── Static frontend (SPA) ─────────────────────────────
	// Serves Vite build from ./web/dist. Falls back to index.html for SPA routing.
	staticDir := "./web/dist"
	fileServer := http.FileServer(http.Dir(staticDir))
	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(staticDir, filepath.Clean(r.URL.Path))
		info, err := os.Stat(path)
		if err != nil || info.IsDir() {
			http.ServeFile(w, r, staticDir+"/index.html")
			return
		}
		fileServer.ServeHTTP(w, r)
	})

	return r
}
