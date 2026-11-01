import { readFileSync } from 'node:fs';
import errorService from './../services/error.server.service.mjs';
import userProfile from './../../../users/server/controllers/users.profile.server.controller.mjs';
import textService from './../services/text.server.service.mts';
import log from './../../../../config/lib/logger.mjs';
import deprecatedLanguages from './../../../../config/languages/deprecated.mts';
import reactRouteOwnership, {
  type ReactRouteUser,
} from '../../shared/react-route-ownership.mts';
import type { UserServerDocument } from '../../../users/server/models/user.server.types.mts';
const languagesObject: Record<string, string> = JSON.parse(
  readFileSync(
    new URL('../../../../config/languages/languages.json', import.meta.url),
    'utf8',
  ),
);
const languagesArray: Array<{ value: string; label: string }> = JSON.parse(
  readFileSync(
    new URL(
      '../../../../config/languages/languages-array.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
type BootstrapUser = ReactRouteUser & { username?: string; _id?: unknown };
type IndexRequest = {
  path: string;
  originalUrl?: string;
  user?: UserServerDocument;
  tribe?: unknown;
};
type BootstrapVariables = {
  user: BootstrapUser | null | undefined;
  tribe?: unknown;
  invite?: boolean;
};
type CoreResponse = {
  status(code: number): CoreResponse;
  format(
    handlers: Record<string, () => void> & { default: () => void },
  ): unknown;
  render(view: string, variables?: BootstrapVariables): unknown;
  redirect(url: string): unknown;
  json(value?: unknown): unknown;
  send(value: string): unknown;
};
const service = {
  renderIndex,
  renderNotFound,
  receiveCSPViolationReport,
  getLanguages,
};
const { getReactRouteAccessRedirect, getReactRoutePolicy } =
  reactRouteOwnership;

/**
 * Render the main application page
 */
function renderIndex(req: IndexRequest, res: CoreResponse) {
  const renderVars: BootstrapVariables = {
    user: null,
  };

  // Expose user
  if (req.user) {
    renderVars.user = userProfile.sanitizeOwnProfile(req.user);

    // `sanitizeProfile` strips `roles` so they never leak for *other*
    // members, but the client needs the *current* user's own roles to drive
    // role based route guards (e.g. keeping non-admins out of admin pages).
    // Exposing the authenticated user's own roles to their own browser is
    // safe.
    if (req.user.roles) {
      renderVars.user!.roles = req.user.roles;
    }
  }

  // Expose tribe (when browsing `/tribes/tribe-name`)
  if (req.tribe) {
    renderVars.tribe = req.tribe;
  }

  // Show different `og:` tags for signup pages
  // https://expressjs.com/en/api.html#req.path
  if (req.path === '/signup') {
    renderVars.invite = true;
  }
  const reactRoutePolicy = getReactRoutePolicy(req.path);
  const accessRedirect = getReactRouteAccessRedirect(
    reactRoutePolicy,
    renderVars.user,
    req.originalUrl,
  );
  const redirect = reactRoutePolicy?.redirectTo || accessRedirect;
  if (redirect) {
    return res.redirect(redirect);
  }

  // All SPA routes use the React shell; unknown paths render React NotFound.
  res.render('react-index.server.view.html', renderVars);
}

/**
 * Render the server not found responses
 * Performs content-negotiation on the Accept HTTP header
 */
function renderNotFound(_req: unknown, res: CoreResponse) {
  res.status(404).format({
    'text/html'() {
      res.render('404.server.view.html');
    },
    'application/json'() {
      res.json({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    },
    default() {
      res.send(errorService.getErrorMessageByKey('not-found'));
    },
  });
}

/**
 * Log received CSP violation report
 * See `config/lib/express.js` and `initHelmetHeaders()` for more
 */
function receiveCSPViolationReport(req: { body?: unknown }, res: CoreResponse) {
  if (process.env.NODE_ENV !== 'test') {
    log('warn', 'CSP violation report #ljeanw', {
      report: req.body
        ? textService.plainText(JSON.stringify(req.body))
        : 'No report available.',
    });
  }
  res.status(204).json();
}

// Future push: restore renderServiceWorkerConfig (previously served
// `var FCM_SENDER_ID = …` at GET /config/sw.js) when browser push returns.

function getLanguages(
  req: { query?: Record<string, unknown> } | undefined,
  res: CoreResponse,
) {
  // Return language list in array format
  if (req?.query?.format === 'array') {
    return res.json(
      languagesArray.map(language => ({
        ...language,
        deprecated: (deprecatedLanguages as Set<string>).has(language.value),
      })),
    );
  }

  // Return language list in object format
  res.json(languagesObject);
}
const defaultExport = service;
export default defaultExport;
/** @esmNamed */
export { getLanguages, receiveCSPViolationReport, renderIndex, renderNotFound };
/** @commonjs */
export { defaultExport as 'module.exports' };
