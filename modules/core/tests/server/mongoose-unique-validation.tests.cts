const mongoose: typeof import('mongoose') = require('mongoose');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const uniqueValidation = require('./../../../../config/lib/mongoose-unique-validation.mjs');
require('should');

type HookName =
  'findOneAndUpdate' | 'save' | 'update' | 'updateMany' | 'updateOne';
type HookCallback = (error?: Error | null) => void;
type DuplicateError = {
  code?: number;
  keyPattern?: Record<string, number>;
  keyValue?: Record<string, unknown>;
};
type ErrorHook = (
  error: DuplicateError | Error | null,
  result: unknown,
  callback: HookCallback,
) => void;
type TestSchemaType = { options: { unique: string | boolean } };
type TestSchema = {
  tree: Record<string, unknown>;
  eachPath(callback: (path: string, schemaType: TestSchemaType) => void): void;
  post(name: HookName, callback: ErrorHook): void;
};

describe('Mongoose unique validation adapter', function () {
  function makeSchema(path: string, message: string | boolean) {
    const handlers = {} as Record<HookName, ErrorHook>;
    const schemaType = { options: { unique: message } };
    const schema = {
      tree: {},
      eachPath(callback: Parameters<TestSchema['eachPath']>[0]) {
        callback(path, schemaType);
      },
      post(name: HookName, callback: ErrorHook) {
        handlers[name] = callback;
      },
    };
    uniqueValidation(schema as TestSchema);
    return { handlers, schemaType };
  }

  it('registers duplicate handlers for save and update methods', function () {
    const { handlers } = makeSchema('name', 'Name is taken.');
    Object.keys(handlers)
      .sort()
      .should.deepEqual([
        'findOneAndUpdate',
        'save',
        'update',
        'updateMany',
        'updateOne',
      ]);
  });

  it('handles nested paths and converts duplicate errors', function (done) {
    const { handlers, schemaType } = makeSchema(
      'profile.handle',
      'Handle is taken.',
    );
    schemaType.options.unique.should.equal(true);
    handlers.updateMany(
      {
        code: 11000,
        keyPattern: { 'profile.handle': 1 },
        keyValue: { 'profile.handle': 'example' },
      },
      null,
      function (error?: Error | null) {
        assert.ok(error instanceof mongoose.Error.ValidationError);
        error.errors['profile.handle'].message.should.equal('Handle is taken.');
        done();
      },
    );
  });

  it('uses the default message and passes through other errors', function (done) {
    const { handlers } = makeSchema('name', true);
    handlers.updateOne(
      { code: 11000, keyPattern: { name: 1 }, keyValue: { name: 'x' } },
      null,
      function (error?: Error | null) {
        assert.ok(error instanceof mongoose.Error.ValidationError);
        error.errors.name.message.should.equal(
          'Path `name` (x) is not unique.',
        );
        const original = new Error('database unavailable');
        handlers.save(original, null, function (passed?: Error | null) {
          assert.equal(passed, original);
          done();
        });
      },
    );
  });
});
