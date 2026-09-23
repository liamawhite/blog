# Liam White's blog

A minimal static Astro site, using Bun for dependencies and the runtime.

## Prerequisites

- Nix with `nix-command` and `flakes` enabled.
- Make available on your system to run the initial command.

The Nix flake provides Bun, Git, GNU Make, and Wrangler on macOS and Linux (ARM64 and x86-64).
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
| `make deploy-check` | Build and validate the Cloudflare deployment without publishing |
| `make deploy` | Build and publish to Cloudflare, including the custom domain |
| `make deploy-preview PR=3` | Build and publish the isolated `pr-3` Worker Preview |
| `make delete-preview PR=3` | Delete `pr-3` and its deployments without rebuilding |

You can also enter `nix develop`, then use `bun install --frozen-lockfile`
and `bun run dev`, `bun run build`, or `bun run preview` directly.
Package scripts explicitly use the Bun runtime for Astro.

## Project

The homepage is in `src/pages/index.astro`. The site uses plain CSS and system
fonts, with no client JavaScript in the production homepage. Blog layouts and
analytics will be added later. Talk restoration tasks are tracked
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

The **hygiene** GitHub Actions workflow runs only on `pull_request`, on an Ubuntu
runner with Nix. It runs `make size` and a Wrangler deployment dry run without
Cloudflare credentials. Build failures, failing checker tests, budget violations,
and invalid deployment configuration fail **build and enforce size budgets**,
which is required on `main`.

## Cloudflare deployment

`wrangler.jsonc` defines the `liamwhite-blog` Worker, its static assets from
`dist/`, and the `liamwhite.blog` custom domain. There is no Worker script or
Terraform state. Cloudflare manages the custom domain's DNS record and TLS
certificate. The `workers.dev` address also remains enabled for troubleshooting.
Missing pages return the static `404.html` with a 404 status.

The flake exposes `wrangler` using Nix's Node runtime and the exact Wrangler
dependency pinned in `package.json` and `bun.lock`. This provides the newer
Worker Previews CLI while Nixpkgs still packages an older release. Run
`make install` first, then use `nix develop --command wrangler` from the
repository root for direct CLI access. Bun still manages dependencies and runs
Astro; Node runs Wrangler.

The **deploy** workflow runs on pushes to `main`, builds once, then publishes
using the repository's `CLOUDFLARE_API_TOKEN` Actions secret. The account ID is
public configuration in `wrangler.jsonc`. Production deployments are serialized;
a newer push does not cancel an in-flight deployment. PR checks never deploy.

For a local deployment, authenticate once with:

```sh
nix develop --command wrangler login
make deploy
```

Alternatively, supply `CLOUDFLARE_API_TOKEN` through your environment. GitHub's
stored secret is available only to Actions, not to local commands. Never commit
the token. `make deploy-check` does not require authentication or change remote
resources; the first real deployment verifies the token permissions and domain
availability. An existing conflicting domain/DNS configuration must be resolved
before Cloudflare can attach the hostname.

After deployment, verify `https://liamwhite.blog/` returns the homepage and an
unknown path returns 404. To roll back site content, revert the change through a
PR and merge it; the deployment workflow publishes the rebuilt site.

## Pull request previews

After the required Hygiene checks pass, PRs from branches in this repository get
an isolated Cloudflare Worker Preview named `pr-<number>`. The preview job
rebuilds the same PR merge revision using the lockfile, publishes it, checks the
returned URL, and updates a single bot comment on the PR. New pushes update the
same preview URL. Production remains on `liamwhite.blog`.

The empty `previews` block in `wrangler.jsonc` enables native Worker Previews;
the existing `preview_urls: false` setting concerns version URLs. Preview
deployments ignore dashboard Base settings. The generated preview assets include
an `X-Robots-Tag: noindex, nofollow` response header. Previews are public, and that
header is a search-engine instruction, not access control.

When the PR closes or merges, the cleanup job deletes the Preview and updates
the bot comment. A missing Preview is a successful no-op when using an API token.
Deploy and cleanup jobs share a per-PR concurrency group. Fork and Dependabot PRs
run Hygiene only and never receive the Cloudflare token. No `pull_request_target`
workflow executes PR code.

Locally, authenticate with Wrangler or set `CLOUDFLARE_API_TOKEN`, then use the
Make commands above. Both require an explicit positive PR number. Preview
creation and deletion use the same existing Actions secret as production.
