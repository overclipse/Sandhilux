package checker

import (
	"context"
	"testing"
	"time"
)

// ── Базовая рассылка ─────────────────────────────────────────

func TestBroadcaster_OneSubscriberReceivesEvent(t *testing.T) {
	source := make(chan CheckEvent, 1)
	bc := NewBroadcaster(source)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go bc.Run(ctx)

	_, sub := bc.Subscribe()

	source <- CheckEvent{ID: "evt-1", Status: "up"}

	select {
	case got := <-sub:
		if got.ID != "evt-1" {
			t.Errorf("expected ID=evt-1, got %q", got.ID)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout: subscriber did not receive event")
	}
}

func TestBroadcaster_MultipleSubscribersAllReceive(t *testing.T) {
	source := make(chan CheckEvent, 1)
	bc := NewBroadcaster(source)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go bc.Run(ctx)

	_, sub1 := bc.Subscribe()
	_, sub2 := bc.Subscribe()
	_, sub3 := bc.Subscribe()

	source <- CheckEvent{ID: "evt-broadcast", Status: "down"}

	for i, sub := range []<-chan CheckEvent{sub1, sub2, sub3} {
		select {
		case got := <-sub:
			if got.ID != "evt-broadcast" {
				t.Errorf("sub%d: expected ID=evt-broadcast, got %q", i+1, got.ID)
			}
		case <-time.After(time.Second):
			t.Fatalf("sub%d: timeout — event not received", i+1)
		}
	}
}

// ── Unsubscribe ──────────────────────────────────────────────

func TestBroadcaster_UnsubscribedDoesNotReceive(t *testing.T) {
	source := make(chan CheckEvent, 1)
	bc := NewBroadcaster(source)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go bc.Run(ctx)

	id, sub := bc.Subscribe()
	bc.Unsubscribe(id) // сразу отписываемся

	source <- CheckEvent{ID: "evt-after-unsub"}

	// Небольшая пауза чтобы Broadcaster успел обработать событие
	time.Sleep(50 * time.Millisecond)

	select {
	case got := <-sub:
		t.Errorf("unsubscribed client received event: %q", got.ID)
	default:
		// OK — канал пуст
	}
}

func TestBroadcaster_OtherSubscribersWorkAfterUnsub(t *testing.T) {
	source := make(chan CheckEvent, 1)
	bc := NewBroadcaster(source)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go bc.Run(ctx)

	id1, _ := bc.Subscribe()
	_, sub2 := bc.Subscribe()

	bc.Unsubscribe(id1) // первый отписался

	source <- CheckEvent{ID: "evt-1"}

	select {
	case got := <-sub2:
		if got.ID != "evt-1" {
			t.Errorf("expected evt-1, got %q", got.ID)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout: second subscriber did not receive event")
	}
}

// ── Несколько событий ────────────────────────────────────────

func TestBroadcaster_MultipleEventsInOrder(t *testing.T) {
	source := make(chan CheckEvent, 3)
	bc := NewBroadcaster(source)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go bc.Run(ctx)

	_, sub := bc.Subscribe()

	source <- CheckEvent{ID: "evt-1"}
	source <- CheckEvent{ID: "evt-2"}
	source <- CheckEvent{ID: "evt-3"}

	for _, want := range []string{"evt-1", "evt-2", "evt-3"} {
		select {
		case got := <-sub:
			if got.ID != want {
				t.Errorf("expected %q, got %q", want, got.ID)
			}
		case <-time.After(time.Second):
			t.Fatalf("timeout waiting for %q", want)
		}
	}
}

// ── Shutdown ─────────────────────────────────────────────────

func TestBroadcaster_StopsOnContextCancel(t *testing.T) {
	source := make(chan CheckEvent, 1)
	bc := NewBroadcaster(source)

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		bc.Run(ctx)
		close(done)
	}()

	cancel()

	select {
	case <-done:
		// OK — Run завершился
	case <-time.After(time.Second):
		t.Fatal("Broadcaster did not stop after context cancel")
	}
}

func TestBroadcaster_ClosesSubsOnShutdown(t *testing.T) {
	source := make(chan CheckEvent, 1)
	bc := NewBroadcaster(source)

	ctx, cancel := context.WithCancel(context.Background())

	go bc.Run(ctx)

	_, sub := bc.Subscribe()

	cancel() // shutdown

	// После отмены канал подписчика должен быть закрыт
	select {
	case _, ok := <-sub:
		if ok {
			t.Error("expected channel to be closed, got value")
		}
		// ok=false — канал закрыт, правильно
	case <-time.After(time.Second):
		t.Fatal("timeout: subscriber channel not closed after shutdown")
	}
}

// ── Полный буфер ─────────────────────────────────────────────

func TestBroadcaster_FullSubscriberBufferDoesNotBlock(t *testing.T) {
	source := make(chan CheckEvent, 1)
	bc := NewBroadcaster(source)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go bc.Run(ctx)

	_, sub := bc.Subscribe()

	// Заполняем буфер подписчика (64 события) не читая из него
	for i := range cap(sub) {
		source <- CheckEvent{ID: "fill"}
		time.Sleep(time.Millisecond) // даём Broadcaster обработать
		_ = i
	}

	// Отправляем ещё одно событие когда буфер полный
	done := make(chan struct{})
	go func() {
		source <- CheckEvent{ID: "overflow"}
		close(done)
	}()

	select {
	case <-done:
		// OK — не заблокировался
	case <-time.After(2 * time.Second):
		t.Fatal("Broadcaster blocked when subscriber buffer was full")
	}
}
