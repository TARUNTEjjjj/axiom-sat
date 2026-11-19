// Serve the packaged dist/ release on localhost for the browser regression suite.
// Like Cloudflare Pages, /practice resolves to practice.html and a missing path gets 404.html.
// Node built-ins only: this is test tooling, not part of the deployed application.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../dist', import.meta.url)));
const port = Number(process.env.PORT || 4317);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

async function file(path) {
  try {
    const info = await stat(path);
    if (info.isFile()) return path;
    if (info.isDirectory()) return file(resolve(path, 'index.html'));
  } catch {}
  return null;
}

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const target = resolve(root, `.${pathname}`);
  if (target !== root && !target.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  const found = (await file(target)) || (extname(target) ? null : await file(`${target}.html`));
  const path = found || resolve(root, '404.html');
  response.writeHead(found ? 200 : 404, {
    'Content-Type': types[extname(path)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  response.end(request.method === 'HEAD' ? undefined : await readFile(path));
}).listen(port, '127.0.0.1', () => console.log(`Serving dist/ at http://127.0.0.1:${port}`));
