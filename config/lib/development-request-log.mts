import type { RequestHandler } from 'express';
import { redactSupportRequestUrl } from '../../modules/support/shared/request-url.ts';

export type DevelopmentRequestLog = (
  level: 'info',
  message: string,
  meta: Record<string, unknown>,
) => unknown;

/**
 * Logs each development HTTP request once its response has closed.
 * The logger is injected so tests need no module mocking.
 */
export function createDevelopmentRequestLogger(
  log: DevelopmentRequestLog,
): RequestHandler {
  return (req, res, next) => {
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
}
