// Stryker runs the tests in a sandbox copy whose node_modules is a link to the
// checkout's, so workspace packages would resolve to the unmutated original.
// Point them at the sandbox copy instead.
import { realpathSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sandbox = pathToFileURL(`${process.cwd()}/`).href;
const checkout = pathToFileURL(
  `${path.dirname(realpathSync('node_modules'))}/`,
).href;

if (checkout !== sandbox) {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      return resolved.url.startsWith(`${checkout}packages/`)
        ? { ...resolved, url: sandbox + resolved.url.slice(checkout.length) }
        : resolved;
    },
  });
}
