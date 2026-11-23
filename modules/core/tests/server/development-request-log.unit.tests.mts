import { expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createDevelopmentRequestLogger } from '../../../../config/lib/development-request-log.mts';

it('logs the outcome without logging the support search query', async () => {
  const log = vi.fn();
  const app = express();
  app.use(createDevelopmentRequestLogger(log));
  app.get('/api/admin/support', (_req, res) => res.send('ok'));

  await request(app).get('/api/admin/support?q=private').expect(200);

  // The response `close` event can fire after the client has the response.
  await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(1));
  expect(log).toHaveBeenCalledExactlyOnceWith('info', 'HTTP request', {
    method: 'GET',
    url: '/api/admin/support',
    status: 200,
    durationMs: expect.any(Number),
    contentLength: '2',
  });
});
