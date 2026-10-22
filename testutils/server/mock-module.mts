import {
  createRequire,
  registerHooks,
  stripTypeScriptTypes,
} from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type MockStubs = Record<string, unknown>;

type MockModule = {
  filename: string;
  url: string;
  id: number;
  stubs: MockStubs;
};

type ResolveHook = NonNullable<Parameters<typeof registerHooks>[0]['resolve']>;
type LoadHook = NonNullable<Parameters<typeof registerHooks>[0]['load']>;

const mocks = new Map<string, MockModule>();
const values = new Map<string, unknown>();
const registryKey = Symbol.for('trustroots.test.moduleMocks');
const require = createRequire(import.meta.url);
Reflect.set(globalThis, registryKey, values);
let sequence = 0;

const resolve: ResolveHook = (specifier, context, nextResolve) => {
  const mock = mocks.get(specifier);
  if (mock) {
    return { url: mock.url, format: 'module', shortCircuit: true };
  }

  const parentMock = [...mocks.values()].find(
    item => item.url === context.parentURL,
  );
  if (parentMock) {
    const normalise = (value: string): string =>
      value.startsWith('.')
        ? path
            .resolve(path.dirname(parentMock.filename), value)
            .replace(/\.(?:mjs|mts|js|ts)$/, '')
        : value;
    const key = Object.keys(parentMock.stubs).find(
      candidate => normalise(candidate) === normalise(specifier),
    );
    if (key) {
      const id = `${parentMock.id}:${key}`;
      values.set(id, parentMock.stubs[key]);
      return {
        url: `trustroots-mock:${id}`,
        format: 'module',
        shortCircuit: true,
      };
    }
  }

  return nextResolve(specifier, context);
};

const load: LoadHook = (url, context, nextLoad) => {
  const mock = [...mocks.values()].find(item => item.url === url);
  if (mock) {
    const loaded = nextLoad(pathToFileURL(mock.filename).href, context);
    const source = mock.filename.endsWith('.mts')
      ? stripTypeScriptTypes(
          typeof loaded.source === 'string'
            ? loaded.source
            : new TextDecoder().decode(loaded.source as ArrayBuffer),
          { mode: 'strip', sourceUrl: pathToFileURL(mock.filename).href },
        )
      : loaded.source;
    return { format: 'module', source, shortCircuit: true };
  }
  if (url.startsWith('trustroots-mock:')) {
    const id = url.slice('trustroots-mock:'.length);
    const value = values.get(id) as MockStubs;
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
};

registerHooks({ resolve, load });

function mockModule<T = unknown>(filename: string, stubs: MockStubs): T {
  const id = ++sequence;
  const virtual = `${filename}.mock-${id}.mjs`;
  const url = pathToFileURL(virtual).href;
  mocks.set(virtual, { filename, url, id, stubs });
  return require(virtual) as T;
}

export default mockModule;
