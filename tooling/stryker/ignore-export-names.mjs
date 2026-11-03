// Stryker ignorer: skip mutants inside export specifiers. Our CommonJS
// interop exports (`export { x as 'module.exports' }`) use a string name that
// Stryker would mutate, and it cannot place a mutant there.
export const strykerPlugins = [
  {
    kind: 'Ignore',
    name: 'export-names',
    value: {
      shouldIgnore(path) {
        if (path.isExportSpecifier() || path.parentPath?.isExportSpecifier()) {
          return 'Export names are not behaviour.';
        }
        return undefined;
      },
    },
  },
];
