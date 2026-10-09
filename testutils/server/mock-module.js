const { registerHooks } = require('node:module');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const mocks = new Map();
const values = new Map();
const symbol = Symbol.for('trustroots.test.moduleMocks');
global[symbol] = values;
let sequence = 0;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (mocks.has(specifier)) {
      const mock = mocks.get(specifier);
      return { url: mock.url, format: 'module', shortCircuit: true };
    }
    const mock = [...mocks.values()].find(
      item => item.url === context.parentURL,
    );
    if (mock) {
      const normalise = value =>
        value.startsWith('.')
          ? path
              .resolve(path.dirname(mock.filename), value)
              .replace(/\.(?:mjs|js)$/, '')
          : value;
      const key = Object.keys(mock.stubs).find(
        candidate => normalise(candidate) === normalise(specifier),
      );
      if (key) {
        const id = `${mock.id}:${key}`;
        values.set(id, mock.stubs[key]);
        return {
          url: `trustroots-mock:${id}`,
          format: 'module',
          shortCircuit: true,
        };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const mock = [...mocks.values()].find(item => item.url === url);
    if (mock) {
      const loaded = nextLoad(pathToFileURL(mock.filename).href, context);
      return { format: 'module', source: loaded.source, shortCircuit: true };
    }
    if (url.startsWith('trustroots-mock:')) {
      const id = url.slice('trustroots-mock:'.length);
      const value = values.get(id);
      const names = Object.keys(value).filter(
        name => /^[A-Za-z_$][\w$]*$/.test(name) && name !== 'default',
      );
      const source =
        `const value = globalThis[Symbol.for('trustroots.test.moduleMocks')].get(${JSON.stringify(
          id,
        )});\n` +
        'export default value;\n' +
        names.map(name => `export const ${name} = value.${name};`).join('\n') +
        '\nexport { value as "module.exports" };';
      return { format: 'module', source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

module.exports = function mockModule(filename, stubs) {
  const id = ++sequence;
  const virtual = `${filename}.mock-${id}.mjs`;
  const url = pathToFileURL(virtual).href;
  mocks.set(virtual, { filename, url, id, stubs });
  return require(virtual);
};
