import * as Sentry from '@sentry/browser';
import * as Integrations from '@sentry/integrations';

// Make sure to call Sentry.init after importing AngularJS.
// You can also pass {angular: AngularInstance} to the Integrations.Angular() constructor.
Sentry.init({
  integrations: [new Integrations.Angular()],
  ...SENTRY_OPTIONS,
});

console.log('using sentry with options!', SENTRY_OPTIONS);
