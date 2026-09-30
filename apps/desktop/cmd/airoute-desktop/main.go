package main

import (
	"context"
	"log"
	"os"
	"os/signal"

	"airoute/server/app"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	const addr = "127.0.0.1:8787"
	ready := make(chan struct{})
	errCh := make(chan error, 1)
	go func() {
		errCh <- app.Run(ctx, app.Options{
			Addr: addr,
			OnReady: func() {
				close(ready)
			},
		})
	}()
	select {
	case err := <-errCh:
		if err != nil {
			log.Fatal(err)
		}
		return
	case <-ready:
	}
	if err := openWindow("http://" + addr); err != nil {
		log.Fatal(err)
	}
}
