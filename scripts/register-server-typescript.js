const fs = require('fs');
const ts = require('typescript');

// NYC's CommonJS hook compiles raw .cts text before Node can strip its types.
// Server tests use TypeScript's equivalent CommonJS output instead.
require.extensions['.cts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      inlineSourceMap: true,
      inlineSources: true,
    },
  });
  module._compile(outputText, filename);
};
