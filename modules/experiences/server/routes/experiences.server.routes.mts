import type { Express, RequestHandler, RequestParamHandler } from 'express';

import config from '../../../../config/config.mts';
import experiencesPolicy from '../policies/experiences.server.policy.mts';
import experiences from '../controllers/experiences.server.controller.mjs';
import changes from '../controllers/experience-changes.server.controller.mjs';

type MiddlewareCallback = (...args: never[]) => unknown;

// Route policies establish the request shape each narrower controller needs.
const routeHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestHandler => callback as unknown as RequestHandler;
const parameterHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestParamHandler => callback as unknown as RequestParamHandler;

function register(app: Express) {
  if (config.featureFlags.reference) {
    app
      .route('/api/experiences')
      .all(routeHandler(experiencesPolicy.isAllowed))
      .post(routeHandler(experiences.create))
      .get(routeHandler(experiences.readMany));
    app
      .route('/api/experiences/count')
      .all(routeHandler(experiencesPolicy.isAllowed))
      .get(routeHandler(experiences.getCount));
    app
      .route('/api/experiences/suggestion')
      .all(routeHandler(experiencesPolicy.isAllowed))
      .get(routeHandler(experiences.getSuggestion));
    app
      .route('/api/experiences/reply-recipient/:recipientUsername')
      .all(routeHandler(experiencesPolicy.isAllowed))
      .get(routeHandler(experiences.readReplyRecipient));
    app
      .route('/api/my-experience')
      .all(routeHandler(experiencesPolicy.isAllowed))
      .get(routeHandler(experiences.readMine));
    app
      .route('/api/experiences/:experienceId')
      .all(routeHandler(experiencesPolicy.isAllowed))
      .get(routeHandler(experiences.readOne));

    app
      .route('/api/experiences/:id/change-access')
      .all(routeHandler(experiencesPolicy.isAllowedChange))
      .get(routeHandler(changes.readAccess));

    app
      .route('/api/experiences/:id/change-requests')
      .all(routeHandler(experiencesPolicy.isAllowedChange))
      .post(routeHandler(changes.submit));

    app
      .route('/api/experiences/:id/change-requests/mine')
      .all(routeHandler(experiencesPolicy.isAllowedChange))
      .get(routeHandler(changes.readMine));

    app.param('experienceId', parameterHandler(experiences.experienceById));
  }
}
export { register };
export default register;
export { register as 'module.exports' };
