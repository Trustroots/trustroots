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

interface TestModuleTiming {
  moduleId: string;
  diagnostic(): { duration: number };
}

function recordTimings(modules: Iterable<TestModuleTiming>, output: string) {
  const durations: Durations = {};
  for (const module of modules) {
    const file = path.relative(process.cwd(), module.moduleId);
    durations[file] = Math.max(1, module.diagnostic().duration);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(durations, null, 2) + '\n');
}

module.exports = { readTimings, recordTimings };
