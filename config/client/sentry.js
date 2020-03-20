import * as Sentry from '@sentry/browser';
import * as Integrations from '@sentry/integrations';

export function init(dsn) {
  Sentry.init({
    dsn,
    integrations: [new Integrations.Angular()],
  });
}
