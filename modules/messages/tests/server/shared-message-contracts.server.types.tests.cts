const assert: typeof import('assert/strict') = require('assert/strict');
const { execFileSync } = require('child_process');
const path: typeof import('path') = require('path');

describe('Message shared API contract compiler checks', function () {
  this.timeout(30000);
  const root = path.resolve(__dirname, '../../../..');

  function diagnostics(
    before: string | undefined,
    after: string | undefined,
  ): Array<{ code: number; messageText: string }> {
    const output = execFileSync(
      process.execPath,
      [
        path.join(
          root,
          'modules/admin/tests/fixtures/shared-api-contract-diagnostics.mts',
        ),
        JSON.stringify({
          root,
          file:
            before === undefined
              ? undefined
              : 'modules/messages/server/services/messages-payload.server.service.mts',
          before,
          after,
        }),
      ],
      { env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' },
    );
    return JSON.parse(output) as Array<{
      code: number;
      messageText: string;
    }>;
  }

  it('checks the unmodified message payload implementation', () => {
    assert.deepEqual(diagnostics(undefined, undefined), []);
  });

  it('rejects an invalid server-selected request field', () => {
    const errors = diagnostics(
      'userTo: body.userTo,',
      'userTo: Number(body.userTo),',
    );
    assert(errors.some(error => error.code === 2322));
  });

  it('rejects a private field in the message response builder', () => {
    const errors = diagnostics(
      'userFrom: message.userFrom,',
      'userFrom: message.userFrom, spam: true,',
    );
    assert(errors.some(error => error.code === 2353));
  });

  it('rejects a malformed inbox excerpt response', () => {
    const errors = diagnostics(
      'message: { excerpt },',
      'message: { content: excerpt },',
    );
    assert(errors.some(error => error.messageText.includes('excerpt')));
  });
});
