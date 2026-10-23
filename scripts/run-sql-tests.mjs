// Runs every PGlite SQL runner (tests/sql/run-*-pglite.mjs) in a child process.
// In-memory Postgres (PGlite) only: no hosted database, no credentials.
// Fails if a runner exits non-zero or prints a FAIL line.
// Usage: npm run test:sql            (all runners)
//        npm run test:sql -- antiabuse   (only runners whose name contains "antiabuse")
// tests/sql/run-order-handoff.sh is not included: it needs podman + a postgres
// container and covers the same chain as the PGlite runners.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'tests/sql');
const filter = process.argv.slice(2);
const runners = fs
  .readdirSync(dir)
  .filter((f) => /^run-.*-pglite\.mjs$/.test(f))
  .filter((f) => !filter.length || filter.some((x) => f.includes(x)))
  .sort();
if (!runners.length) {
  console.error('No PGlite runners found', filter.length ? `for ${filter.join(', ')}` : '');
  process.exit(1);
}
const concurrency = Math.max(1, Math.min(Number(process.env.SQL_TEST_CONCURRENCY) || os.cpus().length, 4));

function runOne(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(dir, file)], { cwd: root, env: { ...process.env, SKIBIDI_ROOT: root } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => {
      const failLine = out.split('\n').find((l) => /^\s*FAIL\b/.test(l));
      resolve({ file, code, ok: code === 0 && !failLine, out, secs: ((Date.now() - started) / 1000).toFixed(1) });
    });
  });
}

const queue = [...runners];
const results = [];
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const r = await runOne(queue.shift());
      results.push(r);
      console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.file} (${r.secs}s)`);
      if (!r.ok) console.log(r.out.split('\n').map((l) => `    ${l}`).join('\n'));
    }
  })
);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} SQL runners passed`);
process.exit(failed.length ? 1 : 0);
