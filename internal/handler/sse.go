package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Events — GET /api/events
// Server-Sent Events stream. Каждый клиент получает свой канал через Broadcaster.
//
// Схема:
//
//	checker → Events канал → Broadcaster → sub (этот клиент)
//	                                     → sub (другой клиент)
func (h *Handler) Events(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	// Регистрируем этого клиента — получаем персональный канал
	id, sub := h.Broadcaster.Subscribe()
	defer h.Broadcaster.Unsubscribe(id) // снимаем подписку при отключении

	heartbeat := time.NewTicker(30 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			// Клиент закрыл соединение
			return

		case event, ok := <-sub:
			if !ok {
				// Broadcaster закрыл канал (shutdown)
				return
			}
			data, _ := json.Marshal(map[string]any{
				"type": "check_result",
				"data": event,
			})
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()

		case <-heartbeat.C:
			fmt.Fprintf(w, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}
