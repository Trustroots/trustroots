import mongoose, { type Schema } from 'mongoose';

/** Convert duplicate-key errors into the validation errors used by our models. */
const service = function uniqueValidation<
  DocType,
  M,
  TInstanceMethods,
  TQueryHelpers,
  TVirtuals,
  TStaticMethods,
>(
  schema: Schema<
    DocType,
    M,
    TInstanceMethods,
    TQueryHelpers,
    TVirtuals,
    TStaticMethods
  >,
) {
  // Mongoose exposes this schema definition map at runtime.
  const schemaWithTree = schema as typeof schema & {
    tree: Record<string, { unique?: boolean } | undefined>;
  };
  const messages: Record<string, string> = {};
  schema.eachPath(function (path, schemaType) {
    if (typeof schemaType.options.unique === 'string') {
      messages[path] = schemaType.options.unique;
      schemaType.options.unique = true;
      // Nested paths are absent from schema.tree; schemaType.options is enough
      // for Mongoose to register the unique index.
      if (schemaWithTree.tree[path]) {
        schemaWithTree.tree[path].unique = true;
      }
    }
  });
  function handleDuplicate(
    error: Error & {
      code?: number;
      keyPattern?: Record<string, unknown>;
      keyValue?: Record<string, unknown>;
    },
    result: unknown,
    next: (error: Error) => void,
  ) {
    if (error.code !== 11000 || !error.keyPattern) {
      return next(error);
    }
    const validationError = new mongoose.Error.ValidationError();
    Object.keys(error.keyPattern).forEach(function (path) {
      validationError.addError(
        path,
        new mongoose.Error.ValidatorError({
          path,
          type: 'unique',
          value: error.keyValue && error.keyValue[path],
          message: messages[path] || 'Path `{PATH}` ({VALUE}) is not unique.',
        }),
      );
    });
    next(validationError);
  }

  // Custom messages on schema.index({ ... }, { unique: 'message' }) are not
  // supported; this adapter reads messages from individual schema paths.
  schema.post('save', handleDuplicate);
  schema.post('updateOne', handleDuplicate);
  schema.post('updateMany', handleDuplicate);
  schema.post('findOneAndUpdate', handleDuplicate);
};
export default service;
export { service as 'module.exports' };
