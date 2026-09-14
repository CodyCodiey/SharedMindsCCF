/**
 * Stamps a content hash onto every asset the page loads, so a browser cannot
 * serve a stale one after an edit.
 *
 * Versioning only style.css and main.js is not enough: main.js pulls in a dozen
 * modules by relative path, and those URLs never change, so a cached pool.js
 * survives any number of deploys. Every intra-src import gets the stamp too.
 *
 * The stamp is a hash of the files themselves, so it only moves when something
 * actually changed — an edit busts the cache, a redeploy of identical files
 * does not. Run it after editing, before uploading:  node tools/stamp.mjs
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const strip = (s) => s.replace(/\?v=[a-f0-9]{8}/g, '');

const files = readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
const css = join(ROOT, 'style.css');

// hash the content with any old stamp removed, so the hash is of the code
const h = createHash('sha256');
h.update(strip(readFileSync(css, 'utf8')));
for (const f of files) h.update(strip(readFileSync(join(SRC, f), 'utf8')));
const v = h.digest('hex').slice(0, 8);

let touched = 0;
const write = (path, next, was) => {
  if (next === was) return;
  writeFileSync(path, next);
  touched++;
};

// the two entry points, in the page
const idx = join(ROOT, 'index.html');
const before = readFileSync(idx, 'utf8');
write(idx, strip(before)
  .replace('href="style.css"', `href="style.css?v=${v}"`)
  .replace('src="src/main.js"', `src="src/main.js?v=${v}"`), before);

// and every module those entry points reach
for (const f of files) {
  const p = join(SRC, f);
  const was = readFileSync(p, 'utf8');
  write(p, strip(was).replace(/(from '\.\/[\w.-]+\.js)'/g, `$1?v=${v}'`), was);
}

// The tools reach into src/ too, and an unstamped import is a DIFFERENT module
// to Node — two copies of config.js, so a tool that pins a setting tunes one
// and measures the other. §10 again: module-level config is shared between
// instances, right up until a query string quietly makes two of them.
const TOOLS = join(ROOT, 'tools');
if (existsSync(TOOLS)) {
  for (const f of readdirSync(TOOLS).filter((x) => /\.(mjs|js|html)$/.test(x))) {
    const p = join(TOOLS, f);
    const was = readFileSync(p, 'utf8');
    write(p, strip(was).replace(/((?:from|import)\s*\(?\s*'\.\.\/src\/[\w.-]+\.js)'/g, `$1?v=${v}'`), was);
  }
}

console.log(`stamped ?v=${v} — ${touched} file(s) rewritten`);
