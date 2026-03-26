package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"overclipse/Sandhilux/internal/app"
)

func main() {
	_ = godotenv.Load() // .env is optional

	addr := os.Getenv("HTTP_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	log.Printf("starting server on %s", addr)
	if err := app.Run(addr); err != nil {
		log.Fatal(err)
	}
}
