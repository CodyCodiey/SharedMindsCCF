// §9 — the browser cannot fetch captions cross-origin, so this tiny local
// server shells out to yt-dlp for the caption track and parses the VTT to
// word-level timings. It also serves the page, which is what gives the
// microphone the secure context it needs (localhost counts).
//
// node server/server.js [port]

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseVTT } from './vtt.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/* ------------------------------------------------------------------ captions */

function run(cmd, args, ms = 90000) {
  return new Promise((resolve) => {
    // stdin is closed so a prompt cannot block, and a stalled fetch is killed
    // rather than left to hold the request open with nothing to show for it.
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '', done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); resolve(r); };
    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      finish({ code: -2, out, err: `timed out after ${Math.round(ms / 1000)}s` });
    }, ms);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => finish({ code: -1, out, err: e.message }));
    p.on('close', (code) => finish({ code, out, err }));
  });
}

async function captions(url) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'droplet-'));
  try {
    const r = await run('yt-dlp', [
      '--skip-download', '--no-warnings',
      '--write-auto-subs', '--write-subs',
      '--sub-langs', 'en.*,en',
      '--sub-format', 'vtt',
      '-o', path.join(dir, 'cap.%(ext)s'),
      url,
    ]);
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.vtt'));
    if (!files.length) {
      const why = r.code === -1 ? 'yt-dlp not found — brew install yt-dlp'
        : r.code === -2 ? r.err
        : (r.err.trim().split('\n').pop() || 'no english captions on that video');
      throw new Error(why);
    }
    // prefer a hand-made track over the automatic one when both came down
    files.sort((a, b) => (a.includes('orig') ? 1 : 0) - (b.includes('orig') ? 1 : 0));
    const vtt = await fs.readFile(path.join(dir, files[0]), 'utf8');
    const words = parseVTT(vtt);
    if (!words.length) throw new Error('captions had no words in them');
    return { words, track: files[0] };
  } finally {
    fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* -------------------------------------------------------------------- serve */

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('request failed:', err && err.message);
    if (res.headersSent) { res.end(); return; }
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('server error');
  });
});

async function handle(req, res) {
  let u;
  try {
    u = new URL(req.url, 'http://localhost');
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('bad request');
    return;
  }

  if (u.pathname === '/api/captions') {
    const target = u.searchParams.get('url');
    res.setHeader('content-type', 'application/json; charset=utf-8');
    if (!target) { res.writeHead(400); res.end(JSON.stringify({ error: 'no url' })); return; }
    try {
      const data = await captions(target);
      console.log(`captions: ${data.words.length} words from ${data.track}`);
      res.writeHead(200);
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error('captions failed:', err.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // decodeURIComponent throws URIError on a malformed escape, and an unhandled
  // throw in an async handler takes the whole process down — one `GET /%` was
  // enough to kill the server and the secure context the microphone needs.
  let file;
  try {
    file = decodeURIComponent(u.pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('bad path');
    return;
  }
  if (file === '/') file = '/index.html';
  const full = path.join(ROOT, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(ROOT)) { res.writeHead(403); res.end('no'); return; }
  try {
    const body = await fs.readFile(full);
    res.writeHead(200, { 'content-type': TYPES[path.extname(full)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}

// Nothing below should be able to take the process down with it.
process.on('uncaughtException', (err) => console.error('uncaught:', err && err.message));
process.on('unhandledRejection', (err) => console.error('unhandled:', err && err.message));

server.listen(PORT, () => {
  console.log(`droplet on http://localhost:${PORT}`);
  console.log('localhost counts as a secure context, so the microphone works here.');
});
