# Liam White's blog

A minimal static Astro site, using Bun for dependencies and the runtime.

## Prerequisites

- Nix with `nix-command` and `flakes` enabled.
- Make available on your system to run the initial command.

The Nix flake provides Bun, Git, and GNU Make on macOS and Linux (ARM64 and x86-64).
It pins Nixpkgs 26.05, which still supports Intel Macs.

## Development

```sh
make dev
```

This installs dependencies from `bun.lock` inside the Nix development environment
and starts Astro at <http://localhost:4321>. Astro reloads changes automatically.
Press Ctrl-C to stop. The first run needs network access to fetch the Nix tools
and JavaScript dependencies.

When Astro detects an agent environment, it may start the server in the
background instead. Stop it with `nix develop --command bun --bun astro dev stop`
(or `astro preview stop` for the preview server).

| Command | Action |
| --- | --- |
| `make install` | Install dependencies using the frozen lockfile |
| `make dev` | Install dependencies and start the development server |
| `make build` | Install dependencies and build the static site into `dist/` |
| `make preview` | Build and serve the production site locally |
| `make size` | Build once, test the size checker, and enforce per-page size budgets |

You can also enter `nix develop`, then use `bun install --frozen-lockfile`
and `bun run dev`, `bun run build`, or `bun run preview` directly.
Package scripts explicitly use the Bun runtime for Astro.

## Project

The homepage is in `src/pages/index.astro`. The site uses plain CSS and system
fonts, with no client JavaScript in the production homepage. Blog layouts,
analytics, and deployment will be added later. Talk restoration tasks are tracked
in `todo.md`.

Keep `flake.lock` and `bun.lock` in version control. To update tools, run
`nix flake update`; to update JavaScript dependencies, edit `package.json` and run
`nix develop --command bun install`, then verify `make build`.

## Size budgets and CI

Run `make size` before opening a pull request. Limits live in `size-budget.json`
and use decimal bytes:

- HTML plus referenced CSS: 30,000 bytes gzipped.
- Referenced and inline executable JavaScript: zero bytes.
- Referenced fonts: zero bytes.
- Estimated page payload: 200,000 bytes.

The checker reports raw and gzip sizes for every generated HTML page and its
local assets. Shared assets are counted once per page; CSS imports and `url()`
references are followed. Inline CSS is already included in the HTML size.
JSON-LD is allowed and counted as HTML, not executable JavaScript.

The page estimate uses gzip for text and original sizes for binary assets. It
conservatively includes lazy media and all `srcset` variants. It is not an actual
browser transfer measurement or an initial-load timing test. Remote resources,
embedded documents, and missing files fail the check rather than bypassing the
budgets. Analytics will require an explicit measurement policy when added;
there is no analytics exception yet. The checker assumes conventional generated
HTML/CSS URLs, not escaped CSS URLs or runtime-generated resource requests.

The **Hygiene** GitHub Actions workflow runs only on `pull_request`, on an Ubuntu
runner with Nix. It runs `make size`, so a build failure, failing checker test, or
budget violation fails **Build and size budgets**. There is no push trigger or
deployment step. To prevent merging failed checks, select this check as required
in the repository's branch rules; the workflow itself does not change those rules.
