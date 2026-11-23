export function pick(
  source: object,
  keys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    keys
      .filter(key => key in source)
      .map(key => [key, Reflect.get(source, key)]),
  );
}
