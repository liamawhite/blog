import { appendFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function previewName(pr: string | undefined) {
  if (!pr || !/^[1-9][0-9]*$/.test(pr)) {
    throw new Error('Supply a positive PR number, for example: make deploy-preview PR=3');
  }
  return `pr-${pr}`;
}

export function previewURL(output: string) {
  const records = output.trim().split('\n').map(line => JSON.parse(line));
  const value = records.findLast(record => record.type === 'preview')?.preview_urls?.[0];
  if (typeof value !== 'string') throw new Error('Wrangler did not return a Preview URL.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') || url.username || url.password) {
    throw new Error('Unexpected Preview URL; expected HTTPS on workers.dev.');
  }
  return url.href;
}

async function main() {
  const name = previewName(process.env.PR);
  const command = process.argv[2];
  if (command === 'delete') {
    // A PR may close before its checks finish or before any preview is created.
    if (process.env.CLOUDFLARE_API_TOKEN) {
      const config = await Bun.file('wrangler.jsonc').json();
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/workers/workers/${config.name}/previews/${name}`, {
        headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
      });
      if (response.status === 404) {
        console.log(`Preview ${name} does not exist; nothing to delete.`);
        return;
      }
      if (!response.ok) throw new Error(`Preview lookup failed: HTTP ${response.status}`);
    }
    const child = Bun.spawn(['wrangler', 'preview', 'delete', '--name', name, '--skip-confirmation'], {
      stdin: 'ignore', stdout: 'inherit', stderr: 'inherit',
    });
    process.exitCode = await child.exited;
    return;
  }
  if (command !== 'deploy') throw new Error('Expected deploy or delete.');

  // Only the rebuilt preview output gets this header, never production assets.
  await appendFile('dist/_headers', '\n/*\n  X-Robots-Tag: noindex, nofollow\n');
  const directory = await mkdtemp(join(tmpdir(), 'blog-preview-'));
  try {
    const outputPath = join(directory, 'output.jsonl');
    const child = Bun.spawn(['wrangler', 'preview', '--name', name, '--ignore-base-config'], {
      stdin: 'ignore', stdout: 'inherit', stderr: 'inherit',
      env: { ...process.env, WRANGLER_OUTPUT_FILE_PATH: outputPath },
    });
    const code = await child.exited;
    if (code !== 0) {
      process.exitCode = code;
      return;
    }
    const url = previewURL(await Bun.file(outputPath).text());
    console.log(`Preview: ${url}`);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `preview_url=${url}\n`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
