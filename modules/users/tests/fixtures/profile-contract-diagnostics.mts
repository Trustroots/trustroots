import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

interface DiagnosticArguments {
  root: string;
  before: string;
  after: string;
}

interface DiagnosticRecord {
  code: number;
  messageText: string;
}

const argument = process.argv[2];
if (argument === undefined) throw new Error('Expected diagnostic arguments');
const { root, before, after } = JSON.parse(argument) as DiagnosticArguments;
const configPath = path.join(root, 'tsconfig.contracts.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(config.error, undefined);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
assert.deepEqual(parsed.errors, []);
const host = ts.createCompilerHost(parsed.options);
const original = host.readFile.bind(host);
const target = path.join(
  root,
  'modules/users/server/services/profile-response.server.service.mts',
);
host.readFile = (filename: string) => {
  const source = original(filename);
  if (filename !== target) return source;
  assert(source !== undefined, 'The compiler mutation target must exist.');
  assert(
    typeof before === 'string' && typeof after === 'string',
    'A compiler mutation requires before and after text.',
  );
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
  .map((item): DiagnosticRecord => ({
    code: item.code,
    messageText: ts.flattenDiagnosticMessageText(item.messageText, '\n'),
  }));
process.stdout.write(JSON.stringify(errors));
