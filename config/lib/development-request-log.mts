import type { RequestHandler } from 'express';
import log from '@trustroots/logger';
import { redactSupportRequestUrl } from '../../modules/support/shared/request-url.ts';

const logDevelopmentRequest: RequestHandler = (req, res, next) => {
  const start = performance.now();

  res.once('close', () => {
    log('info', 'HTTP request', {
      method: req.method,
      url: redactSupportRequestUrl(req.originalUrl || req.url || ''),
      status: res.headersSent ? res.statusCode : undefined,
      durationMs: Math.round((performance.now() - start) * 1000) / 1000,
      contentLength: res.getHeader('content-length'),
    });
  });

  next();
};

export default logDevelopmentRequest;
