import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'oxc-transform';

// Node strips TypeScript types but cannot run JSX, so compile this package's
// .tsx files when they load. Other files keep Node's own loader.
const packageUrl = new URL('../', import.meta.url).href;

registerHooks({
  load(url, context, nextLoad) {
    // Stryker disable next-line StringLiteral: compiling the package's .ts files as well gives the same modules
    if (!url.startsWith(packageUrl) || !url.endsWith('.tsx')) {
      return nextLoad(url, context);
    }
    const filename = fileURLToPath(url);
    const { code, errors } = transformSync(
      filename,
      readFileSync(filename, 'utf8'),
    );
    if (errors.length) throw new Error(errors[0].message);
    return { format: 'module', source: code, shortCircuit: true };
  },
});
