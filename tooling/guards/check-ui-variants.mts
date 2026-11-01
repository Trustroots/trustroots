#!/usr/bin/env node
/**
 * No dead variants: every value of every cva() variant in
 * packages/ui/src/components must be used somewhere in app code (modules/,
 * layers/, apps/; tests and visual fixtures don't count).
 *
 * A value counts as used when app code passes it to a prop declared by the
 * component's file, as a JSX attribute or as a property of an object literal
 * typed by that file (such as a `look` object or a `buttonClassName()`
 * argument). The TypeScript checker reads the type of the passed expression,
 * so `colour={status}` counts every literal `status` can hold. A default value
 * counts when a component from the file is used without that prop.
 *
 * Defaults that depend on another prop are declared next to the cva() call
 * with a `@variantDefaults PROP by OTHER` JSDoc tag on an object literal that
 * maps each OTHER value to a list whose first entry is PROP's default:
 *
 *   /** @variantDefaults colour by variant *\/
 *   const colours = { solid: ['default', 'primary'], link: ['link'] } as const;
 *
 * There, `<Button variant="link">` without a colour uses colour `link`.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export type UnusedVariant = {
  file: string;
  variant: string;
  value: string;
};

type Variants = Map<string, Set<string>>;

type ComponentFile = {
  file: string;
  variants: Variants;
  defaults: Map<string, string>;
  /** prop → (other prop value → default) */
  dependentDefaults: Map<string, { by: string; map: Map<string, string> }>;
  used: Map<string, Set<string>>;
};

const APP_DIRS = ['modules', 'layers', 'apps'];
const SKIPPED_DIRS = new Set([
  'node_modules',
  'tests',
  'test',
  'dist',
  'build',
]);

function listFiles(dir: string, filter: (file: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_DIRS.has(entry.name) ? [] : listFiles(full, filter);
    }
    return filter(full) ? [full] : [];
  });
}

const isSource = (file: string) =>
  /\.(ts|tsx|mts|cts)$/.test(file) &&
  !/\.d\.ts$/.test(file) &&
  !/\.(test|tests|spec)\.[cm]?tsx?$/.test(file);

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isNumericLiteral(name)) return name.text;
  return undefined;
}

function objectProperties(node: ts.Node | undefined) {
  const entries = new Map<string, ts.Expression>();
  if (!node || !ts.isObjectLiteralExpression(node)) return entries;
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property)) {
      const name = propertyName(property.name);
      if (name !== undefined) entries.set(name, property.initializer);
    }
  }
  return entries;
}

function unwrap(node: ts.Expression): ts.Expression {
  while (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

function literalText(node: ts.Expression): string | undefined {
  node = unwrap(node);
  if (ts.isStringLiteralLike(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return 'true';
  if (node.kind === ts.SyntaxKind.FalseKeyword) return 'false';
  return undefined;
}

/** Reads the cva() calls and default tables of one component file. */
function readComponentFile(file: string): ComponentFile {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const component: ComponentFile = {
    file,
    variants: new Map(),
    defaults: new Map(),
    dependentDefaults: new Map(),
    used: new Map(),
  };
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'cva'
    ) {
      const config = objectProperties(node.arguments[1]);
      for (const [variant, values] of objectProperties(
        config.get('variants'),
      )) {
        const set = component.variants.get(variant) ?? new Set<string>();
        for (const value of objectProperties(values).keys()) set.add(value);
        component.variants.set(variant, set);
      }
      for (const [variant, value] of objectProperties(
        config.get('defaultVariants'),
      )) {
        const text = literalText(value);
        if (text !== undefined) component.defaults.set(variant, text);
      }
    }
    if (ts.isVariableStatement(node)) {
      const tags = ts
        .getJSDocTags(node)
        .filter(tag => tag.tagName.text === 'variantDefaults');
      for (const tag of tags) {
        const comment = ts.getTextOfJSDocComment(tag.comment) ?? '';
        const match = /^\s*(\w+)\s+by\s+(\w+)/.exec(comment);
        const declaration = node.declarationList.declarations[0];
        if (!match || !declaration?.initializer) continue;
        const map = new Map<string, string>();
        for (const [key, list] of objectProperties(
          unwrap(declaration.initializer),
        )) {
          const array = unwrap(list);
          if (!ts.isArrayLiteralExpression(array)) continue;
          const first = array.elements[0];
          const text = first && literalText(first);
          if (text !== undefined) map.set(key, text);
        }
        component.dependentDefaults.set(match[1], { by: match[2], map });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return component;
}

function compilerOptions(root: string): ts.CompilerOptions {
  const configFile = path.join(root, 'tsconfig.json');
  const defaults: ts.CompilerOptions = {
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    allowJs: false,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  };
  if (!fs.existsSync(configFile)) return defaults;
  const read = ts.readConfigFile(configFile, ts.sys.readFile);
  if (read.error) return defaults;
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root);
  return { ...parsed.options, noEmit: true, skipLibCheck: true };
}

/** The literal values an expression can hold, by its type. */
function literalValues(checker: ts.TypeChecker, node: ts.Node): string[] {
  const type = checker.getTypeAtLocation(node);
  const parts = type.isUnion() ? type.types : [type];
  return parts.flatMap(part => {
    if (part.isStringLiteral()) return [part.value];
    if (part.flags & ts.TypeFlags.BooleanLiteral) {
      return [checker.typeToString(part)];
    }
    return [];
  });
}

export function analyze(
  root = path.resolve(import.meta.dirname, '../..'),
): UnusedVariant[] {
  root = fs.realpathSync(path.resolve(root));
  const componentDir = path.join(root, 'packages/ui/src/components');
  const components = listFiles(componentDir, file => /\.tsx?$/.test(file))
    .map(readComponentFile)
    .filter(component => component.variants.size > 0);
  if (components.length === 0) return [];
  const byFile = new Map(
    components.map(component => [path.resolve(component.file), component]),
  );

  const appFiles = APP_DIRS.flatMap(dir =>
    listFiles(path.join(root, dir), isSource),
  );
  const program = ts.createProgram({
    rootNames: [...appFiles, ...components.map(c => c.file)],
    options: compilerOptions(root),
  });
  const checker = program.getTypeChecker();

  const declaredIn = (symbol: ts.Symbol | undefined) => {
    const found = new Set<ComponentFile>();
    if (!symbol) return found;
    if (symbol.flags & ts.SymbolFlags.Alias) {
      symbol = checker.getAliasedSymbol(symbol);
    }
    for (const declaration of symbol.declarations ?? []) {
      const file = path.resolve(declaration.getSourceFile().fileName);
      const component = byFile.get(file);
      if (component) found.add(component);
      // A prop typed by a component file's type, such as ButtonGroup's
      // `size?: ButtonSize`, passes its value on to that component.
      const typeNode =
        ts.isPropertySignature(declaration) ||
        ts.isPropertyDeclaration(declaration)
          ? declaration.type
          : undefined;
      if (!typeNode) continue;
      const visitType = (node: ts.Node) => {
        if (ts.isTypeReferenceNode(node)) {
          let reference = checker.getSymbolAtLocation(node.typeName);
          if (reference && reference.flags & ts.SymbolFlags.Alias) {
            reference = checker.getAliasedSymbol(reference);
          }
          for (const typeDeclaration of reference?.declarations ?? []) {
            const owner = byFile.get(
              path.resolve(typeDeclaration.getSourceFile().fileName),
            );
            if (owner) found.add(owner);
          }
        }
        ts.forEachChild(node, visitType);
      };
      visitType(typeNode);
    }
    return found;
  };

  const markUsed = (
    owners: Set<ComponentFile>,
    prop: string,
    values: string[],
  ) => {
    for (const owner of owners) {
      if (!owner.variants.has(prop)) continue;
      const set = owner.used.get(prop) ?? new Set<string>();
      values.forEach(value => set.add(value));
      owner.used.set(prop, set);
    }
  };

  /** Component files that declare `name` on the props or object `node` is typed by. */
  const propOwners = (node: ts.Expression | ts.JsxAttributes, name: string) => {
    const owners = new Set<ComponentFile>();
    const contextual = checker.getContextualType(node);
    if (!contextual) return owners;
    const parts = contextual.isUnion() ? contextual.types : [contextual];
    for (const part of parts) {
      for (const owner of declaredIn(checker.getPropertyOfType(part, name))) {
        owners.add(owner);
      }
    }
    return owners;
  };

  const appFileSet = new Set(appFiles.map(file => path.resolve(file)));
  for (const source of program.getSourceFiles()) {
    if (!appFileSet.has(path.resolve(source.fileName))) continue;
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const given = new Map<string, string[]>();
        let spreads = false;
        for (const attribute of node.attributes.properties) {
          if (ts.isJsxSpreadAttribute(attribute)) {
            spreads = true;
            continue;
          }
          const name = attribute.name.getText(source);
          const values = !attribute.initializer
            ? ['true']
            : ts.isStringLiteral(attribute.initializer)
              ? [attribute.initializer.text]
              : ts.isJsxExpression(attribute.initializer) &&
                  attribute.initializer.expression
                ? literalValues(checker, attribute.initializer.expression)
                : [];
          given.set(name, values);
          markUsed(propOwners(node.attributes, name), name, values);
        }
        // Defaults: a component from the file, used without the prop. A
        // spread may set any prop, so it settles no default.
        if (!spreads) {
          for (const owner of declaredIn(
            checker.getSymbolAtLocation(node.tagName),
          )) {
            for (const [prop, value] of owner.defaults) {
              if (given.has(prop) || owner.dependentDefaults.has(prop)) {
                continue;
              }
              markUsed(new Set([owner]), prop, [value]);
            }
            for (const [prop, { by, map }] of owner.dependentDefaults) {
              if (given.has(prop)) continue;
              const others = given.get(by) ?? [owner.defaults.get(by) ?? ''];
              for (const other of others) {
                const value = map.get(other);
                if (value !== undefined) {
                  markUsed(new Set([owner]), prop, [value]);
                }
              }
            }
          }
        }
      }
      if (ts.isObjectLiteralExpression(node)) {
        {
          for (const property of node.properties) {
            if (
              !ts.isPropertyAssignment(property) &&
              !ts.isShorthandPropertyAssignment(property)
            ) {
              continue;
            }
            const name = propertyName(property.name);
            if (name === undefined) continue;
            const owners = propOwners(node, name);
            const value = ts.isPropertyAssignment(property)
              ? property.initializer
              : property.name;
            markUsed(owners, name, literalValues(checker, value));
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return components.flatMap(component =>
    [...component.variants].flatMap(([variant, values]) =>
      [...values]
        .filter(value => !component.used.get(variant)?.has(value))
        .map(value => ({
          file: path.relative(root, component.file),
          variant,
          value,
        })),
    ),
  );
}

export function main(
  _argv: string[],
  root = path.resolve(import.meta.dirname, '../..'),
): number {
  const unused = analyze(root);
  if (unused.length) {
    console.error(
      `UI variants with no use in app code (remove them, or use them):\n${unused
        .map(({ file, variant, value }) => `- ${file}: ${variant}=${value}`)
        .join('\n')}`,
    );
    return 1;
  }
  console.log('Every UI variant is used in app code.');
  return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
