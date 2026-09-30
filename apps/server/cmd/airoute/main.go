package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"

	"airoute/server/app"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8787", "local address to listen on")
	dataDir := flag.String("data", "", "directory for the SQLite database and secret key")
	webDir := flag.String("web", "", "built panel directory")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	if err := app.Run(ctx, app.Options{
		Addr:    *addr,
		DataDir: *dataDir,
		WebDir:  *webDir,
	}); err != nil {
		log.Fatal(err)
	}
}
