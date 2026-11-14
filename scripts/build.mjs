// Package an explicit public-file list; source tests and repository metadata stay private to the build.
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

import {stageResourceExplorer, stageRootOfflineWorker} from './stage-resource-explorer.mjs';
import {readAppRelease, stampAppVersion, writeAppVersion} from './app-release.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const publicFiles = [
  'index.html',
  'bank.html',
  'practice.html',
  'progress.html',
  '404.html',
  '_headers',
  'assets',
  'src',
];
// Check inputs first so a missing route cannot quietly produce a partial release.
for (const file of publicFiles) await stat(resolve(root, file));
const release = await readAppRelease(root, {project:'axiom-sat', sourcePaths:[...publicFiles, 'resources', 'offline-resources-worker.js', 'scripts/build.mjs', 'scripts/app-release.mjs', 'scripts/app-update-protocol.mjs', 'scripts/stage-resource-explorer.mjs'], ignorePaths:['resources/README.md','resources/sources.json']});
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of publicFiles) {
  await cp(resolve(root, file), resolve(output, file), { recursive: true });
  if (file.endsWith('.html')) await writeFile(resolve(output, file), stampAppVersion(await readFile(resolve(root, file), 'utf8'), release));
}
await stageResourceExplorer(root, resolve(output, 'resources'), {release});
await stageRootOfflineWorker(root, output, {release});
await writeAppVersion(output, release, {workers:[{scope:'/',script:'/offline-resources-worker.js'},{scope:'/resources/',script:'/resources/offline-worker.js'}]});
// Verify local links, stylesheets, scripts and imported modules in the release itself.
const { readdir } = await import('node:fs/promises');
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (/\.(html|js)$/.test(entry.name)) {
      const content = await readFile(path, 'utf8');
      const references = entry.name.endsWith('.html')
        ? [...content.matchAll(/(?:href|src)="([^"#]+)"/g)].map((m) => m[1])
        : [...content.matchAll(/(?:from\s*|import\s*\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => m[1]);
      for (const reference of references) {
        if (/^(?:[a-z]+:|\/\/|\/)/i.test(reference)) continue;
        const clean = reference.split(/[?#]/)[0];
        if (!clean) continue;
        try {
          await stat(resolve(dirname(path), clean));
        } catch {
          throw new Error(`Missing release dependency: ${path.slice(output.length + 1)} → ${clean}`);
        }
      }
    }
  }
}
await walk(output);
console.log('Built dist/ with all five pages and validated local dependencies.');
