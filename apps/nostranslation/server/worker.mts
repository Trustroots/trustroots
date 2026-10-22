import { generate } from './generate.mts';
import { runtime } from './runtime.mts';

const { repository, store } = runtime();
try {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.NOSTRANSLATION_MODEL;
  if (!apiKey || !model)
    throw new Error(
      'Set OPENAI_API_KEY and NOSTRANSLATION_MODEL for generation.',
    );
  const count = await generate(
    repository,
    store,
    { apiKey, model },
    Number(process.env.NOSTRANSLATION_GENERATION_LIMIT ?? 100),
  );
  process.stdout.write(
    `Prepared ${count} translation drafts for human review.\n`,
  );
} finally {
  store.close();
}
