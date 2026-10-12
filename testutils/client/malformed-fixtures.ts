/** Deliberately corrupt a valid fixture to exercise a runtime failure path. */
export function malformedFixture<T extends object>(
  valid: T,
  fields: Partial<Record<keyof T, unknown>>,
): T {
  return Object.assign({ ...valid }, fields);
}

/** Network mocks sometimes need to return data outside their declared contract. */
export function resolveMalformed(
  mock: { mockResolvedValueOnce(value: never): unknown },
  value: unknown,
): void {
  Reflect.apply(mock.mockResolvedValueOnce, mock, [value]);
}

/** Exercise defensive checks with arguments unavailable to typed callers. */
export function invokeMalformed<Result>(
  fn: (...args: never[]) => Result,
  ...args: unknown[]
): Result {
  return Reflect.apply(fn, undefined, args);
}
