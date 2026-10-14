const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const {
  execFileSync,
}: typeof import('node:child_process') = require('node:child_process');
const path: typeof import('node:path') = require('node:path');

interface CompilerDiagnostic {
  code: number;
  messageText: string;
}

describe('Profile API contract compiler regressions', function () {
  this.timeout(30000);
  const root = path.resolve(__dirname, '../../../..');

  function diagnostics(before: string, after: string): CompilerDiagnostic[] {
    const output = execFileSync(
      process.execPath,
      [
        path.join(__dirname, '../fixtures/profile-contract-diagnostics.js'),
        JSON.stringify({ root, before, after }),
      ],
      { env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' },
    );
    const parsed: unknown = JSON.parse(output);
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (item: unknown) =>
          typeof item === 'object' &&
          item !== null &&
          'code' in item &&
          typeof item.code === 'number' &&
          'messageText' in item &&
          typeof item.messageText === 'string',
      )
    ) {
      throw new Error('Expected TypeScript diagnostic records');
    }
    return parsed;
  }

  it('rejects an incompatible public-profile value in the real builder', () => {
    const errors = diagnostics(
      'displayName: profile.displayName,',
      'displayName: true,',
    );
    assert(errors.some(item => item.code === 2322));
  });

  it('rejects removing the required identity from the real public builder', () => {
    const errors = diagnostics(
      '_id: profile._id,',
      'username: profile.username,',
    );
    assert(errors.some(item => item.messageText.includes('_id')));
  });
});
