import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { checkSize } from './size';

const directories: string[] = [];
async function fixture(files: Record<string, string>) {
  const directory = await mkdtemp(join(tmpdir(), 'blog-size-'));
  directories.push(directory);
  for (const [name, content] of Object.entries(files)) {
    const path = join(directory, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  return directory;
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test('counts shared CSS once per page, resolving imports, nested routes and query strings', async () => {
  const html = '<link rel="stylesheet" href="/assets/main.css?v=1"><link rel="stylesheet" href="/assets/main.css?v=2"><h1>Post</h1>';
  const css = '@import "./extra.css"; body { color: red }';
  const extra = 'h1 { color: blue }';
  const root = await fixture({ 'index.html': html, 'posts/test/index.html': html, 'assets/main.css': css, 'assets/extra.css': extra });
  const reports = await checkSize(root);
  expect(reports).toHaveLength(2);
  for (const report of reports) {
    expect(report.errors).toEqual([]);
    expect(report.resources).toHaveLength(2);
    expect(report.htmlCssGzip).toBe([html, css, extra].reduce((sum, text) => sum + gzipSync(text).length, 0));
  }
});

test('fails when HTML/CSS exceeds the budget', async () => {
  const root = await fixture({ 'index.html': '<h1>Hello</h1>' });
  const [report] = await checkSize(root, { htmlCssGzip: 1, javascriptRaw: 0, fontsRaw: 0, pageEstimated: 200000 });
  expect(report.errors.some((error) => error.includes('htmlCssGzip'))).toBe(true);
});

test('rejects scripts, inline handlers and fonts reached through CSS', async () => {
  const root = await fixture({
    'index.html': '<link rel="stylesheet" href="/style.css"><button onclick="alert(1)">Hi</button><script src="/app.js"></script><script>console.log(1)</script>',
    'style.css': '@font-face { font-family: test; src: url("/test.woff2") }',
    'app.js': 'console.log(2)',
    'test.woff2': 'test font bytes',
  });
  const [report] = await checkSize(root);
  expect(report.javascriptRaw).toBeGreaterThan('console.log(2)'.length);
  expect(report.errors.some((error) => error.includes('javascriptRaw'))).toBe(true);
  expect(report.errors.some((error) => error.includes('fontsRaw'))).toBe(true);
});

test('allows JSON-LD but rejects unmeasured remote resources and embeds', async () => {
  const root = await fixture({ 'index.html': '<script type="application/ld+json">{"name":"Test"}</script><script src="https://example.com/analytics.js"></script><iframe src="https://example.com/video"></iframe>' });
  const [report] = await checkSize(root);
  expect(report.javascriptRaw).toBe(0);
  expect(report.errors.some((error) => error.includes('external resource'))).toBe(true);
  expect(report.errors.some((error) => error.includes('iframe'))).toBe(true);
});

test('counts images, CSS resources and srcset variants once, including lazy images', async () => {
  const root = await fixture({
    'index.html': '<style>body { background: url(/one.png) }</style><img loading="lazy" src="/one.png" srcset="/one.png 1x, /two.png 2x">',
    'one.png': 'a'.repeat(100001),
    'two.png': 'b'.repeat(100001),
  });
  const [report] = await checkSize(root);
  expect(report.resources).toHaveLength(2);
  expect(report.errors.some((error) => error.includes('pageEstimated'))).toBe(true);
});

test('allows and reports only lazy YouTube privacy-enhanced embeds', async () => {
  const src = 'https://www.youtube-nocookie.com/embed/CK938sKNu4c';
  const root = await fixture({ 'index.html': `<iframe loading="lazy" src="${src}"></iframe>` });
  const [report] = await checkSize(root);
  expect(report.errors).toEqual([]);
  expect(report.excludedEmbeds).toEqual([src]);

  for (const attributes of [
    `src="${src}"`,
    `loading="eager" src="${src}"`,
    `loading="lazy" src="${src}" srcdoc="<p>Other content</p>"`,
    `loading="lazy" src="${src}?autoplay=1"`,
    'loading="lazy" src="https://www.youtube-nocookie.com.evil.example/embed/CK938sKNu4c"',
    'loading="lazy" src="https://www.youtube-nocookie.com/other"',
  ]) {
    await writeFile(join(root, 'index.html'), `<iframe ${attributes}></iframe>`);
    const [rejected] = await checkSize(root);
    expect(rejected.errors.some((error) => error.includes('iframe'))).toBe(true);
    expect(rejected.excludedEmbeds).toEqual([]);
  }
  for (const tag of ['object', 'embed']) {
    await writeFile(join(root, 'index.html'), `<${tag} loading="lazy" src="${src}"></${tag}>`);
    const [rejected] = await checkSize(root);
    expect(rejected.errors.some((error) => error.includes(tag))).toBe(true);
  }
});

test('fails on a missing build or missing referenced asset', async () => {
  const empty = await fixture({});
  await expect(checkSize(empty)).rejects.toThrow('No HTML pages');
  const broken = await fixture({ 'index.html': '<link rel="stylesheet" href="/missing.css">' });
  await expect(checkSize(broken)).rejects.toThrow();
});

test('CLI exits nonzero on violations so CI can enforce the budget', async () => {
  const root = await fixture({ 'dist/index.html': '<script>alert(1)</script>' });
  const result = Bun.spawnSync([process.execPath, join(import.meta.dir, 'size.ts')], { cwd: root });
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain('javascriptRaw');
  await writeFile(join(root, 'dist/index.html'), '<h1>Hello</h1>');
  const passing = Bun.spawnSync([process.execPath, join(import.meta.dir, 'size.ts')], { cwd: root });
  expect(passing.exitCode).toBe(0);
  expect(passing.stdout.toString()).toContain('PASS');
});
