.PHONY: install dev build preview size deploy deploy-check deploy-preview delete-preview
.DEFAULT_GOAL := dev

NIX_RUN := nix develop --command
export PR

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
	$(NIX_RUN) bun test scripts/preview.test.ts
	$(NIX_RUN) bun run scripts/size.ts

deploy-check: build
	$(NIX_RUN) wrangler deploy --dry-run

deploy: build
	$(NIX_RUN) wrangler deploy

deploy-preview: build
	$(NIX_RUN) bun run scripts/preview.ts deploy

delete-preview: install
	$(NIX_RUN) bun run scripts/preview.ts delete
