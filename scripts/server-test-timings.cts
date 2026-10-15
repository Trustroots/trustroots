const fs = require('node:fs') as typeof import('node:fs');
const path = require('node:path') as typeof import('node:path');

type Durations = Record<string, number>;

function readTimings(directory: string): Durations {
  const durations: Durations = {};
  if (!fs.existsSync(directory)) return durations;
  for (const file of fs
    .readdirSync(directory)
    .filter(file => file.endsWith('.json'))
    .sort()) {
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(directory, file), 'utf8'),
      );
      for (const [name, duration] of Object.entries(data)) {
        if (
          typeof duration === 'number' &&
          Number.isFinite(duration) &&
          duration > 0
        ) {
          durations[name] = duration;
        }
      }
    } catch {
      // Timing data is optional; malformed or interrupted writes cannot skip tests.
    }
  }
  return durations;
}

function recordTimings(
  runner: import('mocha').Runner,
  output: string,
  now: () => number = () => performance.now(),
) {
  const durations: Durations = {};
  const starts = new Map<object, number>();
  const start = (item: import('mocha').Suite | import('mocha').Test) => {
    if (item.parent?.root && item.file) starts.set(item, now());
  };
  const end = (item: import('mocha').Suite | import('mocha').Test) => {
    const started = starts.get(item);
    if (started === undefined || !item.file) return;
    const file = path.relative(process.cwd(), item.file);
    durations[file] = (durations[file] || 0) + Math.max(1, now() - started);
    starts.delete(item);
  };
  // Top-level suites include before/after hooks and their nested tests. Root
  // tests are measured separately so nested tests are never counted twice.
  runner.on('suite', start);
  runner.on('suite end', end);
  runner.on('test', start);
  runner.on('test end', end);
  runner.once('end', () => {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(durations, null, 2) + '\n');
  });
}

module.exports = { readTimings, recordTimings };
