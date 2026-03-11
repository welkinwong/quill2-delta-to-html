import { Bench } from 'tinybench';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { QuillDeltaToHtmlConverter } = require('../dist/commonjs/main.js');

const DEFAULT_FIXTURE_PATH = resolve(process.cwd(), 'bench/fixtures/large-1000.json');
const DEFAULT_SEGMENT_TEXT_LENGTH = 1000;
const DEFAULT_TARGET_TEXT_LENGTH = 100000;
const ROUNDS_FOR_PERCENTILES = 30;

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  const safeIndex = Math.min(Math.max(index, 0), sortedValues.length - 1);
  return sortedValues[safeIndex];
}

function buildSyntheticOps(targetLength) {
  const chunk = 'This is a benchmark sentence with mixed content. ';
  let content = '';
  while (content.length < targetLength) {
    content += chunk;
  }
  content = content.slice(0, targetLength);

  const paragraphLength = 120;
  const lines = [];
  for (let i = 0; i < content.length; i += paragraphLength) {
    lines.push(content.slice(i, i + paragraphLength));
  }

  const ops = [];
  for (let i = 0; i < lines.length; i++) {
    ops.push({
      insert: lines[i],
      attributes: i % 3 === 0 ? { bold: true } : undefined,
    });
    ops.push({ insert: '\n' });
  }
  return ops;
}

function ensureFixtureFile(pathToFixture) {
  if (existsSync(pathToFixture)) {
    return;
  }

  mkdirSync(dirname(pathToFixture), { recursive: true });
  const synthetic = {
    note: 'Auto-generated 1000-char segment fixture for local benchmark.',
    ops: buildSyntheticOps(DEFAULT_SEGMENT_TEXT_LENGTH),
  };
  writeFileSync(pathToFixture, JSON.stringify(synthetic, null, 2), 'utf8');
}

function estimateOpsChars(ops) {
  return ops.reduce((count, op) => {
    if (typeof op.insert !== 'string') {
      return count;
    }
    return count + op.insert.length;
  }, 0);
}

function cloneOp(op) {
  if (typeof structuredClone === 'function') {
    return structuredClone(op);
  }
  return JSON.parse(JSON.stringify(op));
}

function expandOpsToTargetChars(segmentOps, targetChars) {
  const segmentChars = estimateOpsChars(segmentOps);
  if (segmentChars <= 0) {
    throw new Error('Fixture ops contain zero text length, cannot expand to target chars.');
  }
  if (segmentChars >= targetChars) {
    return {
      ops: segmentOps,
      segmentChars,
      expandedChars: segmentChars,
      times: 1,
    };
  }

  const expandedOps = [];
  let expandedChars = 0;
  let idx = 0;
  while (expandedChars < targetChars) {
    const nextOp = segmentOps[idx % segmentOps.length];
    expandedOps.push(cloneOp(nextOp));
    if (typeof nextOp.insert === 'string') {
      expandedChars += nextOp.insert.length;
    }
    idx++;
  }

  return {
    ops: expandedOps,
    segmentChars,
    expandedChars,
    times: Math.ceil(expandedChars / segmentChars),
  };
}

function loadOps(pathToFixture) {
  ensureFixtureFile(pathToFixture);
  const fixture = JSON.parse(readFileSync(pathToFixture, 'utf8'));
  const ops = fixture.ops || fixture;
  if (!Array.isArray(ops)) {
    throw new Error('Fixture format invalid. Expect JSON array or object with `ops` array.');
  }
  return ops;
}

function runOneConversion(ops) {
  const converter = new QuillDeltaToHtmlConverter(ops);
  return converter.convert();
}

async function main() {
  const fixturePath = process.env.BENCH_FIXTURE || DEFAULT_FIXTURE_PATH;
  const targetChars = Number(process.env.BENCH_TARGET_CHARS || DEFAULT_TARGET_TEXT_LENGTH);
  const segmentOps = loadOps(fixturePath);
  const expanded = expandOpsToTargetChars(segmentOps, targetChars);
  const ops = expanded.ops;

  console.log(`[bench] fixture: ${fixturePath}`);
  console.log(`[bench] segment chars: ${expanded.segmentChars}`);
  console.log(`[bench] target chars: ${targetChars}`);
  console.log(`[bench] expanded chars: ${expanded.expandedChars}`);
  console.log(`[bench] expand times: ${expanded.times}`);
  console.log(`[bench] ops count: ${ops.length}`);

  if (global.gc) {
    global.gc();
  }
  const memBefore = process.memoryUsage();

  // Warmup for JIT and hot paths.
  runOneConversion(ops);
  runOneConversion(ops);

  const bench = new Bench({
    time: Number(process.env.BENCH_TIME_MS || 2000),
    warmupTime: Number(process.env.BENCH_WARMUP_MS || 500),
  });

  bench.add('convert large delta', () => {
    runOneConversion(ops);
  });

  await bench.run();
  const task = bench.tasks[0];
  const result = task.result;
  if (!result) {
    throw new Error('No benchmark result.');
  }

  const manualDurationsMs = [];
  for (let i = 0; i < ROUNDS_FOR_PERCENTILES; i++) {
    const start = performance.now();
    runOneConversion(ops);
    manualDurationsMs.push(performance.now() - start);
  }
  manualDurationsMs.sort((a, b) => a - b);

  if (global.gc) {
    global.gc();
  }
  const memAfter = process.memoryUsage();

  const meanMs = manualDurationsMs.reduce((acc, n) => acc + n, 0) / manualDurationsMs.length;
  const p95Ms = percentile(manualDurationsMs, 95);
  const p99Ms = percentile(manualDurationsMs, 99);
  const maxMs = manualDurationsMs[manualDurationsMs.length - 1];

  const opsPerSec = result.throughput?.mean ?? 0;

  console.log('\n=== Benchmark Result ===');
  console.log(`name: ${task.name}`);
  console.log(`ops/sec (tinybench): ${opsPerSec.toFixed(2)}`);
  console.log(`mean latency (manual): ${meanMs.toFixed(2)} ms`);
  console.log(`p95 latency (manual): ${p95Ms.toFixed(2)} ms`);
  console.log(`p99 latency (manual): ${p99Ms.toFixed(2)} ms`);
  console.log(`max latency (manual): ${maxMs.toFixed(2)} ms`);
  console.log(`rss before/after: ${formatBytes(memBefore.rss)} -> ${formatBytes(memAfter.rss)}`);
  console.log(`heapUsed before/after: ${formatBytes(memBefore.heapUsed)} -> ${formatBytes(memAfter.heapUsed)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
