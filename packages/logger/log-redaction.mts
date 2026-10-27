import dependency0 from 'util';

const { types } = dependency0;
const REDACTED = '[REDACTED]';
const DEPTH_LIMIT = '[Omitted: metadata depth limit]';
const ENTRY_LIMIT = '[Omitted: metadata entry limit]';
const CIRCULAR = '[Circular]';
const ACCESSOR = '[Accessor omitted]';
const UNINSPECTABLE = '[Uninspectable]';
const BINARY = '[Binary data omitted]';
const MAX_DEPTH = 8;
const MAX_ENTRIES = 1000;
const SAFE_ERROR_NAMES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
  'AbortError',
  'AssertionError',
  'TimeoutError',
  'MongooseError',
  'MongoServerError',
  'CastError',
  'ValidationError',
]);
const sensitiveKeyPatterns = [
  /password|passphrase|passwd/,
  /salt/,
  /token/,
  /secret/,
  /authorization/,
  /cookie/,
  /stack|traceback/,
  /sessionid|sessionkey|apikey|privatekey|otp|onetimecode|verificationcode/,
];
const sensitivePayloadKeys = new Set([
  'body',
  'content',
  'message',
  'messagebody',
  'messagecontent',
  'messagepayload',
  'privatebody',
  'privatecontent',
  'privatemessage',
  'privatemessagebody',
  'privatemessagecontent',
  'privatemessagepayload',
  'privatepayload',
  'report',
]);
function isSensitiveKey(key: string) {
  const normalisedKey = String(key)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return (
    sensitiveKeyPatterns.some(pattern => pattern.test(normalisedKey)) ||
    sensitivePayloadKeys.has(normalisedKey)
  );
}
function safeError(error: object): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: 'Error',
  };
  try {
    let prototype: object | null = error;
    let prototypeDepth = 0;
    while (prototype && prototypeDepth < MAX_DEPTH) {
      const nameDescriptor = Object.getOwnPropertyDescriptor(prototype, 'name');
      if (
        nameDescriptor &&
        Object.prototype.hasOwnProperty.call(nameDescriptor, 'value') &&
        SAFE_ERROR_NAMES.has(nameDescriptor.value)
      ) {
        result.name = nameDescriptor.value;
        break;
      }
      prototype = Object.getPrototypeOf(prototype);
      prototypeDepth += 1;
    }
    for (const key of ['name', 'code', 'status']) {
      const descriptor = Object.getOwnPropertyDescriptor(error, key);
      if (
        descriptor &&
        Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
        ((key === 'name' && SAFE_ERROR_NAMES.has(descriptor.value)) ||
          (key === 'code' && isSafeErrorCode(descriptor.value)) ||
          (key === 'status' &&
            typeof descriptor.value === 'number' &&
            Number.isFinite(descriptor.value)))
      ) {
        result[key] = descriptor.value;
      }
    }
  } catch {
    return {
      name: 'Error',
      details: UNINSPECTABLE,
    };
  }
  return result;
}
function isSafeErrorCode(value: unknown) {
  return (
    typeof value === 'string' &&
    /^[A-Z][A-Z0-9_.-]{0,63}$/.test(value) &&
    !/(TOKEN|PASSWORD|SECRET|COOKIE|AUTH|SESSION|PRIVATE|MESSAGE|EMAIL|USER)/i.test(
      value,
    )
  );
}
function redactMetadata(value: unknown): unknown {
  const seen = new WeakSet();
  let visitedEntries = 0;
  function visit(item: unknown, depth: number): unknown {
    if (item === null || item === undefined) return item;
    const itemType = typeof item;
    if (itemType !== 'object') {
      return itemType === 'function' ? '[Function]' : item;
    }
    let isArray;
    try {
      isArray = Array.isArray(item);
    } catch {
      return UNINSPECTABLE;
    }
    try {
      if (Buffer.isBuffer(item)) return BINARY;
    } catch {
      return UNINSPECTABLE;
    }
    if (types.isNativeError(item)) return safeError(item);
    if (types.isDate(item)) {
      const dateTime = Date.prototype.getTime.call(item);
      return Number.isNaN(dateTime)
        ? '[Invalid Date]'
        : Date.prototype.toISOString.call(item);
    }
    if (depth >= MAX_DEPTH) return DEPTH_LIMIT;
    if (seen.has(item as object)) return CIRCULAR;
    seen.add(item as object);
    if (isArray) {
      const result = [];
      let arrayLength;
      try {
        arrayLength = (item as unknown[]).length;
      } catch {
        return UNINSPECTABLE;
      }
      const length = Math.min(arrayLength, MAX_ENTRIES - visitedEntries);
      for (let index = 0; index < length; index += 1) {
        visitedEntries += 1;
        let descriptor;
        try {
          descriptor = Object.getOwnPropertyDescriptor(item, index);
        } catch {
          return UNINSPECTABLE;
        }
        if (!descriptor) {
          result.push(undefined);
        } else if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          result.push(ACCESSOR);
        } else {
          result.push(visit(descriptor.value, depth + 1));
        }
      }
      if (length < arrayLength) result.push(ENTRY_LIMIT);
      return result;
    }
    const result = {};
    try {
      for (const key in item as object) {
        if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
        if (visitedEntries >= MAX_ENTRIES) {
          Object.defineProperty(result, '[omitted]', {
            value: ENTRY_LIMIT,
            enumerable: true,
          });
          break;
        }
        visitedEntries += 1;
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        const child = isSensitiveKey(key)
          ? REDACTED
          : descriptor &&
              Object.prototype.hasOwnProperty.call(descriptor, 'value')
            ? visit(descriptor.value, depth + 1)
            : ACCESSOR;
        Object.defineProperty(result, key, {
          value: child,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
    } catch {
      return UNINSPECTABLE;
    }
    return result;
  }
  return visit(value, 0);
}
const service = {
  redactMetadata,
  safeError,
};
export default service;
export { service as 'module.exports' };
