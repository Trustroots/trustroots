export function pick(
  source: object | null | undefined,
  keys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    keys
      .filter(key => source != null && key in source)
      .map(key => [key, Reflect.get(source, key)]),
  );
}
