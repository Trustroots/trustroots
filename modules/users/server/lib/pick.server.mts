export function pick(
  source: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  const value: object = Object(source);
  return Object.fromEntries(
    keys.filter(key => key in value).map(key => [key, Reflect.get(value, key)]),
  );
}
