type Callback = (error: unknown, result?: unknown) => void;

type CallbackMethod = (this: unknown, ...args: unknown[]) => unknown;

const wrapped = Symbol('mongooseCallbackCompatible');

const QUERY_METHODS = [
  'find',
  'findOne',
  'estimatedDocumentCount',
  'countDocuments',
  'distinct',
  'deleteOne',
  'deleteMany',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'validate',
  'exec',
] as const;

const MODEL_METHODS = [
  'exists',
  'init',
  'createCollection',
  'syncIndexes',
  'cleanIndexes',
  'listIndexes',
  'ensureIndexes',
  'createIndexes',
  'deleteMany',
  'find',
  'findById',
  'findOne',
  'countDocuments',
  'distinct',
  'findOneAndUpdate',
  'findByIdAndUpdate',
  'findOneAndDelete',
  'findByIdAndDelete',
  'findOneAndReplace',
  'create',
  'insertMany',
  'bulkWrite',
  'aggregate',
  'validate',
  'populate',
] as const;

const MODEL_INSTANCE_METHODS = ['save', 'deleteOne'] as const;

const DOCUMENT_METHODS = ['validate', 'populate'] as const;

const AGGREGATE_METHODS = ['exec', 'explain'] as const;

const CONNECTION_METHODS = [
  'createCollection',
  'startSession',
  'dropCollection',
  'dropDatabase',
  'openUri',
  'destroy',
  'close',
] as const;

const MONGOOSE_METHODS = ['connect', 'disconnect'] as const;

type MongooseLike = {
  Query?: { prototype?: object };
  Model?: object & { prototype?: object };
  Document?: { prototype?: object };
  Aggregate?: { prototype?: object };
  Connection?: { prototype?: object };
};

function callbackCompatible(method: CallbackMethod): CallbackMethod {
  function callbackCompatibleMethod(
    this: unknown,
    ...args: unknown[]
  ): unknown {
    const callbackIndex = args.findIndex(arg => typeof arg === 'function');
    if (callbackIndex === -1) {
      return method.apply(this, args);
    }

    const callback = args[callbackIndex] as Callback;
    let result: unknown;
    try {
      result = method.apply(this, args.slice(0, callbackIndex));
    } catch (error) {
      callback(error);
      return undefined;
    }

    if (
      result != null &&
      typeof (result as { then?: unknown }).then === 'function'
    ) {
      return Promise.resolve(result).then(
        value => {
          callback(null, value);
          return value;
        },
        error => {
          callback(error);
          return undefined;
        },
      );
    }

    callback(null, result);
    return result;
  }

  Object.defineProperty(callbackCompatibleMethod, wrapped, { value: true });
  return callbackCompatibleMethod;
}

function patchMethods(
  owner: object | undefined,
  names: readonly string[],
): void {
  if (owner == null) {
    return;
  }

  const target = owner as Record<string, CallbackMethod | undefined>;
  for (const name of names) {
    const original = target[name];
    if (typeof original !== 'function') {
      continue;
    }
    if (Object.hasOwn(original, wrapped)) {
      continue;
    }
    target[name] = callbackCompatible(original);
  }
}

export function installMongooseCallbackSupport(mongoose: object): void {
  const candidate = mongoose as MongooseLike;
  patchMethods(candidate.Query?.prototype, QUERY_METHODS);
  patchMethods(candidate.Model, MODEL_METHODS);
  patchMethods(candidate.Model?.prototype, MODEL_INSTANCE_METHODS);
  patchMethods(candidate.Document?.prototype, DOCUMENT_METHODS);
  patchMethods(candidate.Aggregate?.prototype, AGGREGATE_METHODS);
  patchMethods(candidate.Connection?.prototype, CONNECTION_METHODS);
  patchMethods(mongoose, MONGOOSE_METHODS);
}
