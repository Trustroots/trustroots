import fs from 'node:fs';

export type ScreenshotBaseStatus = 'passed' | 'failed';

export function validateScreenshotBaseStatus(
  contents: string,
): ScreenshotBaseStatus {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents) as unknown;
  } catch {
    throw new Error('Base E2E run did not write valid status JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Base E2E run did not write a status object.');
  }
  const result = parsed as { status?: unknown; message?: unknown };

  if (result.status === 'blocked') {
    const message =
      typeof result.message === 'string' ? `: ${result.message}` : '';
    throw new Error(`Base E2E setup was blocked${message}`);
  }

  if (result.status !== 'passed' && result.status !== 'failed') {
    throw new Error('Base E2E run did not report a completed test status.');
  }

  return result.status;
}

if (process.argv[1] === import.meta.filename) {
  const statusFile = process.argv[2];
  if (!statusFile) throw new Error('Expected the base E2E status file path.');
  const status = validateScreenshotBaseStatus(
    fs.readFileSync(statusFile, 'utf8'),
  );
  process.stdout.write(`Base E2E test status: ${status}.\n`);
}
