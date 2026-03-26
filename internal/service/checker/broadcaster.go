package checker

import (
	"context"
	"sync"
)

// Broadcaster читает события из одного канала (Events) и рассылает
// каждое событие всем активным подписчикам.
//
// Схема:
//
//	checker.Events (один канал)
//	       │
//	  Broadcaster.Run()  ← единственный читатель Events
//	  ┌────┴────┐
//	 sub1     sub2     sub3  ← персональные каналы SSE клиентов
//	  │         │        │
//	 SSE1     SSE2     SSE3
type Broadcaster struct {
	source <-chan CheckEvent
	mu     sync.Mutex
	subs   map[uint64]chan CheckEvent
	nextID uint64
}

// NewBroadcaster создаёт Broadcaster. source — канал из Checker.Events.
func NewBroadcaster(source <-chan CheckEvent) *Broadcaster {
	return &Broadcaster{
		source: source,
		subs:   make(map[uint64]chan CheckEvent),
	}
}

// Run запускает цикл рассылки. Блокирует до отмены ctx.
// Вызывать как горутину: go bc.Run(ctx).
func (b *Broadcaster) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			// Закрываем все подписки при shutdown
			b.mu.Lock()
			for id, ch := range b.subs {
				close(ch)
				delete(b.subs, id)
			}
			b.mu.Unlock()
			return

		case event := <-b.source:
			// Рассылаем одно событие всем подписчикам
			b.mu.Lock()
			for _, ch := range b.subs {
				// Неблокирующая отправка: медленный клиент теряет событие,
				// но не тормозит остальных
				select {
				case ch <- event:
				default:
				}
			}
			b.mu.Unlock()
		}
	}
}

// Subscribe регистрирует нового подписчика.
// Возвращает ID (для последующего Unsubscribe) и персональный канал событий.
func (b *Broadcaster) Subscribe() (uint64, <-chan CheckEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()

	id := b.nextID
	b.nextID++
	ch := make(chan CheckEvent, 64)
	b.subs[id] = ch
	return id, ch
}

// Unsubscribe удаляет подписчика. Вызывать при отключении SSE клиента.
func (b *Broadcaster) Unsubscribe(id uint64) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.subs, id)
}
