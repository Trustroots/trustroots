const assert = require('assert/strict');
const path = require('path');
const ts = require('typescript');

const { root, before, after } = JSON.parse(process.argv[2]);
const configPath = path.join(root, 'tsconfig.contracts.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(config.error, undefined);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
assert.deepEqual(parsed.errors, []);
const host = ts.createCompilerHost(parsed.options);
const original = host.readFile.bind(host);
const target = path.join(
  root,
  'modules/users/server/services/profile-response.server.service.mjs',
);
host.readFile = filename => {
  const source = original(filename);
  if (filename !== target) return source;
  assert(
    source.includes(before),
    'Mutation must reach the real profile builder.',
  );
  return source.replace(before, after);
};
const program = ts.createProgram(parsed.fileNames, parsed.options, host);
const errors = ts
  .getPreEmitDiagnostics(program)
  .filter(item => item.file?.fileName === target)
  .map(item => ({
    code: item.code,
    messageText: ts.flattenDiagnosticMessageText(item.messageText, '\n'),
  }));
process.stdout.write(JSON.stringify(errors));
