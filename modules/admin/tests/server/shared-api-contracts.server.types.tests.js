const assert = require('assert/strict');
const path = require('path');
const ts = require('typescript');

describe('Shared API contract compiler regressions', function () {
  this.timeout(30000);
  const root = path.resolve(__dirname, '../../../..');
  const configPath = path.join(root, 'tsconfig.contracts.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);

  function diagnostics(file, before, after) {
    const host = ts.createCompilerHost(parsed.options);
    const original = host.readFile.bind(host);
    const target = file && path.join(root, file);
    host.readFile = filename => {
      const source = original(filename);
      if (filename !== target) return source;
      assert(
        source.includes(before),
        'The compiler mutation must reach real server code.',
      );
      return source.replace(before, after);
    };
    const program = ts.createProgram(parsed.fileNames, parsed.options, host);
    return ts
      .getPreEmitDiagnostics(program)
      .filter(item => !target || item.file?.fileName === target);
  }

  it('checks the unmodified shared contracts and server payload builders', () => {
    assert.deepEqual(diagnostics(), []);
  });

  it('rejects a missing staff-blocker response field in the actual implementation', () => {
    const errors = diagnostics(
      'modules/admin/server/services/staff-blockers-payload.server.service.mjs',
      'blockedBy: blockers',
      'blockers: blockers',
    );
    assert(
      errors.some(item =>
        ts
          .flattenDiagnosticMessageText(item.messageText, '\n')
          .includes('blockedBy'),
      ),
    );
  });

  it('rejects an invalid recommendation in the actual experience response builder', () => {
    const errors = diagnostics(
      'modules/experiences/server/services/experience-payload.server.service.mjs',
      'recommend: experience.recommend',
      "recommend: 'sometimes'",
    );
    assert(errors.some(item => item.code === 2322));
  });

  it('rejects an invalid field in the actual create-request builder', () => {
    const errors = diagnostics(
      'modules/experiences/server/services/experience-payload.server.service.mjs',
      'return { ...body, userFrom, public: isPublic };',
      'return { ...body, userTo: 123, userFrom, public: isPublic };',
    );
    assert(errors.some(item => item.code === 2322));
  });

  it('rejects a formatted string in the actual experience count response', () => {
    const errors = diagnostics(
      'modules/experiences/server/services/experience-payload.server.service.mjs',
      'count: privateCount + publicCount',
      'count: String(privateCount + publicCount)',
    );
    assert(errors.some(item => item.code === 2322));
  });
});
