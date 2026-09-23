import { readdir, readFile, realpath } from 'node:fs/promises';
import { extname, resolve, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import budgets from '../size-budget.json';

const origin = 'https://size.invalid';
const fontExtensions = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot']);
const compressedExtensions = new Set(['.html', '.css', '.js', '.mjs', '.svg', '.json', '.txt']);

async function htmlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.isFile() && path.endsWith('.html') ? [path] : [];
  }));
  return files.flat().sort();
}

export async function measurePage(root: string, page: string) {
  root = await realpath(root);
  const html = await readFile(page);
  const pagePath = '/' + relative(root, page).split('\\').join('/');
  const pageURL = new URL(pagePath.replace(/index\.html$/, ''), origin);
  const assets = new Map<string, { css: boolean; script: boolean; font: boolean }>();
  const errors: string[] = [];
  const excludedEmbeds: string[] = [];
  let inlineJavaScript = 0;

  function reference(value: string | null, base: URL, kind = '') {
    if (!value || value.startsWith('#')) return;
    if (value.startsWith('data:')) {
      if (kind === 'script') inlineJavaScript += Buffer.byteLength(value);
      if (/^data:(?:font\/|application\/(?:font|x-font))/i.test(value)) errors.push('Embedded fonts exceed the zero-font budget.');
      return;
    }
    const url = new URL(value, base);
    if (url.origin !== origin) {
      errors.push(`Unmeasured external resource: ${value}`);
      return;
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (relative(root, path).startsWith('..')) throw new Error(`Asset escapes dist: ${value}`);
    const extension = extname(path).toLowerCase();
    const old = assets.get(path);
    assets.set(path, {
      css: old?.css || kind === 'css' || extension === '.css',
      script: old?.script || kind === 'script' || ['.js', '.mjs'].includes(extension),
      font: old?.font || kind === 'font' || fontExtensions.has(extension),
    });
  }

  function cssReferences(css: string, base: URL) {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of source.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/gi)) {
      reference(match[1], base, 'css');
    }
    // Resolve both url(...) references and quoted @import declarations.
    for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)|@import\s+["']([^"']+)["']/gi)) {
      reference(match[1] ?? match[2] ?? match[3] ?? match[4], base, match[4] ? 'css' : '');
    }
  }

  let styleText = '';
  let scriptText = '';
  let executableScript = false;
  const rewriter = new HTMLRewriter()
    .on('*', {
      element(element) {
        const tag = element.tagName;
        for (const [name, value] of element.attributes) {
          if (name.startsWith('on') || /^javascript:/i.test(value.trim())) {
            inlineJavaScript += Buffer.byteLength(value) || 1;
          }
        }
        cssReferences(element.getAttribute('style') ?? '', pageURL);
        if (tag === 'base') errors.push('HTML <base> is unsupported by the size checker.');
        if (tag === 'iframe' || tag === 'object' || tag === 'embed') {
          const src = element.getAttribute('src') ?? '';
          if (tag === 'iframe'
            && /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}$/.test(src)
            && element.getAttribute('loading') === 'lazy'
            && element.getAttribute('srcdoc') === null) {
            excludedEmbeds.push(src);
          } else {
            errors.push(`Embedded <${tag}> content is unmeasured; only lazy YouTube privacy-enhanced players are allowed.`);
          }
        }
        if (tag === 'script') {
          const type = element.getAttribute('type')?.toLowerCase();
          executableScript = !type || type === 'module' || /(?:java|ecma)script/.test(type);
          scriptText = '';
          reference(element.getAttribute('src'), pageURL, 'script');
          element.onEndTag(() => {
            if (executableScript) inlineJavaScript += Buffer.byteLength(scriptText);
          });
        }
        if (tag === 'link') {
          const rel = (element.getAttribute('rel') ?? '').split(/\s+/);
          if (rel.some((r) => ['stylesheet', 'preload', 'modulepreload', 'icon'].includes(r))) {
            const kind = rel.includes('stylesheet') ? 'css' : rel.includes('modulepreload') ? 'script' : element.getAttribute('as') ?? '';
            reference(element.getAttribute('href'), pageURL, kind);
          }
        }
        if (['img', 'source', 'video', 'audio', 'input', 'track'].includes(tag)) {
          reference(element.getAttribute('src'), pageURL);
          reference(element.getAttribute('poster'), pageURL);
          const srcset = element.getAttribute('srcset');
          if (srcset) {
            // Count every variant conservatively, not just the browser's selected candidate.
            if (srcset.includes('data:')) errors.push('Data URLs in srcset are unsupported; use src instead.');
            else for (const candidate of srcset.split(',')) reference(candidate.trim().split(/\s+/)[0], pageURL);
          }
        }
      },
    })
    .on('style', {
      element(element) {
        styleText = '';
        element.onEndTag(() => cssReferences(styleText, pageURL));
      },
      text(chunk) { styleText += chunk.text; },
    })
    .on('script', { text(chunk) { scriptText += chunk.text; } });
  await rewriter.transform(new Response(html)).arrayBuffer();

  let raw = html.length;
  let gzip = gzipSync(html).length;
  let htmlCssGzip = gzip;
  let javascriptRaw = inlineJavaScript;
  let fontsRaw = 0;
  let pageEstimated = gzip;
  const resources = [];
  // Map iteration includes CSS dependencies discovered while traversing.
  for (const [path, kind] of assets) {
    const canonical = await realpath(path);
    if (relative(root, canonical).startsWith('..')) throw new Error(`Asset escapes dist: ${path}`);
    const bytes = await readFile(path);
    const zipped = gzipSync(bytes).length;
    raw += bytes.length;
    gzip += zipped;
    pageEstimated += compressedExtensions.has(extname(path)) ? zipped : bytes.length;
    if (kind.css) {
      htmlCssGzip += zipped;
      cssReferences(bytes.toString(), new URL('/' + relative(root, path), origin));
    }
    if (kind.script) javascriptRaw += bytes.length;
    if (kind.font) fontsRaw += bytes.length;
    resources.push({ path: relative(root, path), raw: bytes.length, gzip: zipped });
  }
  return { page: pagePath, raw, gzip, htmlCssGzip, javascriptRaw, fontsRaw, pageEstimated, resources, excludedEmbeds, errors };
}

export async function checkSize(root: string, limits = budgets) {
  const pages = await htmlFiles(resolve(root));
  if (!pages.length) throw new Error(`No HTML pages found in ${root}; build the site first.`);
  const reports = await Promise.all(pages.map((page) => measurePage(root, page)));
  for (const report of reports) {
    for (const key of Object.keys(limits) as (keyof typeof budgets)[]) {
      if (report[key] > limits[key]) report.errors.push(`${key}: ${report[key]} B exceeds ${limits[key]} B`);
    }
  }
  return reports;
}

if (import.meta.main) {
  try {
    const reports = await checkSize(resolve('dist'));
    for (const report of reports) {
      console.log(`${report.errors.length ? 'FAIL' : 'PASS'} ${report.page}: ${report.raw} B raw, ${report.gzip} B gzip; HTML/CSS ${report.htmlCssGzip}/${budgets.htmlCssGzip} B gzip; JS ${report.javascriptRaw}/${budgets.javascriptRaw} B; fonts ${report.fontsRaw}/${budgets.fontsRaw} B; estimated page ${report.pageEstimated}/${budgets.pageEstimated} B`);
      for (const asset of report.resources) console.log(`  ${asset.path}: ${asset.raw} B raw, ${asset.gzip} B gzip`);
      for (const embed of report.excludedEmbeds) console.log(`  Excluded third-party player payload (including JS/fonts): ${embed}`);
      for (const error of report.errors) console.error(`  ${error}`);
    }
    if (reports.some((report) => report.errors.length)) process.exitCode = 1;
  } catch (error) {
    console.error(`Size check failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
