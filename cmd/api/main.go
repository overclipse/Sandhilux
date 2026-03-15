package main

import (
	"log"
	"os"

	"overclipse/Sandhilux/internal/app"
)

func main() {
	addr := os.Getenv("HTTP_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	if err := app.Run(addr); err != nil {
		log.Fatal(err)
	}
}
