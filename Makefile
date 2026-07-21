# KD-tree CityMap binary viewer — build & serve (Vite + Rolldown).
# `make`         dev server with HMR, http://localhost:5173/
# `make build`   production build (minified) → dist/
# `make preview` serve the production build locally
# `make check`   typecheck only (tsc --noEmit), no emit

.DEFAULT_GOAL := dev

.PHONY: dev build preview check clean install

dev:
	pnpm run dev

build:
	pnpm run build

preview: build
	pnpm run preview

check:
	pnpm run typecheck

clean:
	pnpm run clean

install:
	pnpm install
