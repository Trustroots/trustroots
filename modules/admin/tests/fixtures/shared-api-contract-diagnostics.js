const assert = require('assert/strict');
const path = require('path');
const ts = require('typescript');

const { root, file, before, after } = JSON.parse(process.argv[2]);
const configPath = path.join(root, 'tsconfig.contracts.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(config.error, undefined);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
assert.deepEqual(parsed.errors, []);
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
const errors = ts
  .getPreEmitDiagnostics(program)
  .filter(item => !target || item.file?.fileName === target)
  .map(item => ({
    code: item.code,
    messageText: ts.flattenDiagnosticMessageText(item.messageText, '\n'),
  }));
process.stdout.write(JSON.stringify(errors));
