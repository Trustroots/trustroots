import { createApp } from './app.mts';
import { runtime } from './runtime.mts';
import { generate } from './generate.mts';
import { schedule } from './scheduler.mts';

const { repository, store } = runtime();
const publicURL =
  process.env.NOSTRANSLATION_PUBLIC_API_URL ??
  'https://nostranslation-api.trustroots.org';
const origin =
  process.env.NOSTRANSLATION_ORIGIN ?? 'https://team.trustroots.org';
const server = createApp(
  { publicURL: publicURL.replace(/\/$/, ''), origin },
  repository,
  store,
).listen(Number(process.env.PORT ?? 4310), '0.0.0.0');
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.NOSTRANSLATION_MODEL;
const stop =
  apiKey && model
    ? schedule(
        () =>
          generate(
            repository,
            store,
            { apiKey, model },
            Number(process.env.NOSTRANSLATION_GENERATION_LIMIT ?? 100),
          ),
        () =>
          process.stderr.write(
            'Nostranslation generation failed; drafts preserved. Check API credentials and retry.\n',
          ),
        3600000,
      )
    : () => {};
process.once('SIGTERM', () => {
  stop();
  server.close(() => store.close());
});
