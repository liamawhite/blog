import { expect, test } from 'bun:test';
import { previewName, previewURL } from './preview';

test('requires an explicit numeric PR so cleanup cannot target a production name', () => {
  expect(previewName('123')).toBe('pr-123');
  for (const value of [undefined, '', '0', '-1', 'main', '1; echo nope']) {
    expect(() => previewName(value)).toThrow();
  }
});

test('extracts the stable preview URL, not the unique deployment URL', () => {
  expect(previewURL(JSON.stringify({
    type: 'preview',
    preview_urls: ['https://pr-3-liamwhite-blog.liamawhite.workers.dev'],
    deployment_urls: ['https://deployment-specific.example'],
  }))).toBe('https://pr-3-liamwhite-blog.liamawhite.workers.dev/');
});

test('rejects missing URLs, malformed output and unexpected URL origins', () => {
  for (const output of ['not JSON', '{}', '{"type":"preview","preview_urls":["http://example.com"]}', '{"type":"preview","preview_urls":["https://workers.dev.evil.example"]}']) {
    expect(() => previewURL(output)).toThrow();
  }
});

test('reads preview records alongside other structured Wrangler output', () => {
  expect(previewURL(' {"type":"other"}\n{"type":"preview","preview_urls":["https://pr-3.example.workers.dev"]}\n')).toBe('https://pr-3.example.workers.dev/');
});
