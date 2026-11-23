import { afterEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import log from '@trustroots/logger';
import logDevelopmentRequest from '../../../../config/lib/development-request-log.mts';

vi.mock('@trustroots/logger', () => ({ default: vi.fn() }));

afterEach(() => vi.clearAllMocks());

it('logs the outcome without logging the support search query', async () => {
  const app = express();
  app.use(logDevelopmentRequest);
  app.get('/api/admin/support', (_req, res) => res.send('ok'));

  await request(app).get('/api/admin/support?q=private').expect(200);

  expect(log).toHaveBeenCalledExactlyOnceWith('info', 'HTTP request', {
    method: 'GET',
    url: '/api/admin/support',
    status: 200,
    durationMs: expect.any(Number),
    contentLength: '2',
  });
});
