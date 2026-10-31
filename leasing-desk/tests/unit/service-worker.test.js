// The iPad's offline shell (sw.js) must list every file the page loads; a module missing from it breaks offline start.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = new URL('../../apps/tour-companion/', import.meta.url).pathname;
const read = p => readFileSync(join(APP, p), 'utf8');
const shell = new Function(`return ${read('sw.js').match(/const SHELL = (\[[\s\S]*?\]);/)[1]}`)();
const asShellPath = p => { const r = relative(APP, p); return r.startsWith('..') ? r : './' + r; };

// Every module main.js reaches through static imports
function importGraph(entry) {
  const seen = new Set(), todo = [join(APP, entry)];
  while (todo.length) {
    const file = todo.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(/^import [^;]*? from '(\.[^']+)';/gm)) todo.push(normalize(join(dirname(file), spec)));
  }
  return [...seen].map(asShellPath);
}

describe('offline shell', () => {
  const modules = importGraph('js/main.js');
  const pageFiles = [...read('index.html').matchAll(/(?:src|href)="([^"#:]+)"/g)].map(([, p]) => p.startsWith('.') ? p : './' + p);

  it('lists every module the app imports', () => {
    expect(modules.filter(m => !shell.includes(m))).toEqual([]);
  });
  it('lists no module the app no longer imports', () => {
    const scripts = shell.filter(p => p.endsWith('.js') && !p.endsWith('shared/config.js'));   // config.js is loaded by boot.js
    expect(scripts.filter(p => !modules.includes(p) && !pageFiles.includes(p))).toEqual([]);   // boot.js is a plain <script>
  });
  it('lists every local file the page links (styles, config, manifest, icon)', () => {
    expect(pageFiles.filter(p => !shell.includes(p))).toEqual([]);
  });
  it('every listed file exists (except config.js, which scripts/write-config.mjs writes from .env)', () => {
    const missing = shell.filter(p => p !== './' && !existsSync(join(APP, p)) && !p.endsWith('shared/config.js'));
    expect(missing).toEqual([]);
  });
});
