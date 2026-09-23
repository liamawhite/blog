.PHONY: install dev build preview size
.DEFAULT_GOAL := dev

NIX_RUN := nix develop --command

install:
	$(NIX_RUN) bun install --frozen-lockfile

dev: install
	$(NIX_RUN) bun run dev

build: install
	$(NIX_RUN) bun run build

preview: build
	$(NIX_RUN) bun run preview

size: build
	$(NIX_RUN) bun test scripts/size.test.ts
	$(NIX_RUN) bun run scripts/size.ts
