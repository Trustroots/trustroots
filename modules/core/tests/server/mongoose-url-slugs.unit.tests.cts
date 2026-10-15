const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');

describe('Mongoose URL slug adapter', function () {
  const modelName = 'SlugAdapterFixture';
  afterEach(() => {
    mongoose.deleteModel(modelName);
  });

  async function slug(name: string, options: Record<string, unknown> = {}) {
    const { default: urlSlugs } =
      await import('../../../../config/lib/mongoose-url-slugs.mjs');
    const schema = new mongoose.Schema<{ name: string; slug?: string }>({
      name: String,
    });
    schema.plugin(urlSlugs('name', { indexUnique: false, ...options }));
    const Model = mongoose.model(modelName, schema);
    const document = new Model({ name });
    await document.validate();
    return document.slug;
  }

  it('generates a slug with production dependencies and default options', async function () {
    assert.equal(await slug('Fictional Café Circle'), 'fictional-cafe-circle');
  });

  it('applies custom options without changing defaults for later schemas', async function () {
    assert.equal(
      await slug('Fictional Circle', { separator: '_' }),
      'fictional_circle',
    );
    mongoose.deleteModel(modelName);
    assert.equal(await slug('Fictional Circle'), 'fictional-circle');
  });

  it('retains default options when an override is undefined', async function () {
    assert.equal(
      await slug('Fictional Circle', { separator: undefined }),
      'fictional-circle',
    );
  });
});
