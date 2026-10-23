import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { catalogue } from './catalogue.mts';
import {
  authenticate,
  parseSubmission,
  Problem,
  ReviewService,
} from './service.mts';
import type { Repository } from './github.mts';
import type { Store } from './store.mts';

export interface AppConfig {
  publicURL: string;
  origin: string;
}

export function createApp(
  config: AppConfig,
  repository: Repository,
  store: Store,
  service = new ReviewService(repository, store),
) {
  const app = express();
  const cache = new Map<string, { expires: number; value: object }>();
  const inflight = new Map<string, Promise<object>>();
  const cached = async (key: string, load: () => Promise<object>) => {
    const previous = cache.get(key);
    if (previous && previous.expires > Date.now()) return previous.value;
    if (inflight.has(key)) return inflight.get(key)!;
    const pending = load().then(value => {
      cache.set(key, { expires: Date.now() + 60000, value });
      return value;
    });
    inflight.set(key, pending);
    try {
      return await pending;
    } finally {
      inflight.delete(key);
    }
  };
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    if (req.headers.origin === config.origin) {
      res.set('Access-Control-Allow-Origin', config.origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/api/languages', async (_req, res) => {
    res.json(await cached('languages', () => repository.languages()));
  });
  app.get('/api/catalogue', async (req, res) => {
    const locale = req.query.locale;
    const languages = (await cached('languages', () =>
      repository.languages(),
    )) as { code: string }[];
    if (
      typeof locale !== 'string' ||
      !languages.some(lang => lang.code === locale)
    )
      throw new Problem(400, 'Choose a supported language.');
    const current = await cached(locale, async () =>
      catalogue(locale, await repository.load(locale)),
    );
    res.json(store.withDrafts(current as ReturnType<typeof catalogue>));
  });
  app.post(
    '/api/reviews',
    express.text({ type: 'application/json', limit: '1mb' }),
    async (req, res) => {
      if (typeof req.body !== 'string')
        throw new Problem(400, 'Send a JSON review batch.');
      const now = Math.floor(Date.now() / 1000);
      const signer = authenticate(
        req.headers.authorization,
        req.body,
        config.publicURL + '/api/reviews',
        now,
      );
      if (!store.consumeSignature(signer.id, now))
        throw new Problem(
          401,
          'This signature was already used. Please sign again.',
        );
      let data: unknown;
      try {
        data = JSON.parse(req.body);
      } catch {
        throw new Problem(400, 'Send valid JSON.');
      }
      const batch = parseSubmission(data);
      res.json({ url: await service.submit(batch, signer.pubkey, now) });
    },
  );
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    void _next;
    const status =
      error instanceof Problem
        ? error.status
        : error.type === 'entity.too.large'
          ? 413
          : 503;
    res.status(status).json({
      error:
        error instanceof Problem
          ? error.message
          : 'The translation service is unavailable. Your local draft is safe; please retry.',
    });
  };
  app.use(errors);
  return app;
}
