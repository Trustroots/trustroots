const express: typeof import('express') = require('express');
const request: typeof import('supertest') = require('supertest');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const expressConfig: typeof import('./../../../../config/lib/express.mjs').default & {
  initMiddleware(app: import('express').Express): void;
} = require('./../../../../config/lib/express.mjs');

describe('Request parsing middleware', function () {
  let app: import('express').Express;

  beforeEach(function () {
    app = express();
    expressConfig.initMiddleware(app);
    app.all(
      '/inspect',
      (req: import('express').Request, res: import('express').Response) => {
        res.json({ body: req.body, method: req.method });
      },
    );
    // Express identifies error middleware by its four-argument signature.
    app.use(
      (
        err: Error & { status?: number; type?: string },
        _req: import('express').Request,
        res: import('express').Response,
        next: import('express').NextFunction,
      ) => {
        void next;
        res.status(err.status || 500).json({ type: err.type });
      },
    );
  });

  it('parses JSON', async function () {
    const response = await request(app)
      .post('/inspect')
      .send({ example: 'value' })
      .expect(200);
    assert.deepEqual(response.body, {
      body: { example: 'value' },
      method: 'POST',
    });
  });
});
