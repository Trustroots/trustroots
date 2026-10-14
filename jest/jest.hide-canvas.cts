type ResolveFilename = (
  this: unknown,
  request: string,
  ...args: unknown[]
) => string;

type ModuleWithResolveFilename = typeof import('node:module') & {
  _resolveFilename: ResolveFilename;
};

const moduleWithResolveFilename =
  require('node:module') as ModuleWithResolveFilename;
const originalResolveFilename = moduleWithResolveFilename._resolveFilename;

moduleWithResolveFilename._resolveFilename = function resolveFilename(
  request: string,
  ...args: unknown[]
): string {
  if (request === 'canvas') {
    throw Object.assign(new Error("Cannot find module 'canvas'"), {
      code: 'MODULE_NOT_FOUND',
    });
  }

  return Reflect.apply(originalResolveFilename, this, [
    request,
    ...args,
  ]) as string;
};
