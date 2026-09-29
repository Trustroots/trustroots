import { createRequire } from 'node:module';
import errorService from '../services/error.server.service.js';
import userProfile from '../../../users/server/controllers/users.profile.server.controller.js';
import textService from '../services/text.server.service.js';
import log from '../../../../config/lib/logger.js';
import deprecatedLanguages from '../../../../config/languages/deprecated.js';
import reactRouteOwnership from '../../shared/react-route-ownership.js';

const require = createRequire(import.meta.url);
const languagesObject = require('../../../../config/languages/languages.json');
const languagesArray = require('../../../../config/languages/languages-array.json');
const service = {};

const { getReactRouteAccessRedirect, getReactRoutePolicy } =
  reactRouteOwnership;

/**
 * Render the main application page
 */
service.renderIndex = function (req, res) {
  const renderVars = {
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
      renderVars.user.roles = req.user.roles;
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
};

/**
 * Render the server not found responses
 * Performs content-negotiation on the Accept HTTP header
 */
service.renderNotFound = function (req, res) {
  res.status(404).format({
    'text/html'() {
      res.render('404.server.view.html');
    },
    'application/json'() {
      res.json({ message: errorService.getErrorMessageByKey('not-found') });
    },
    default() {
      res.send(errorService.getErrorMessageByKey('not-found'));
    },
  });
};

/**
 * Log received CSP violation report
 * See `config/lib/express.js` and `initHelmetHeaders()` for more
 */
service.receiveCSPViolationReport = function (req, res) {
  if (process.env.NODE_ENV !== 'test') {
    log('warn', 'CSP violation report #ljeanw', {
      report: req.body
        ? textService.plainText(JSON.stringify(req.body))
        : 'No report available.',
    });
  }
  res.status(204).json();
};

/**
 * Log received CT report
 * See `config/lib/express.js` and `initHelmetHeaders()` for more
 * @link https://helmetjs.github.io/docs/expect-ct/
 * @link https://scotthelme.co.uk/a-new-security-header-expect-ct/
 */
service.receiveExpectCTViolationReport = function (req, res) {
  if (process.env.NODE_ENV !== 'test') {
    log('warn', 'Expect-CT violation report #3hg8ha', {
      report: req.body
        ? textService.plainText(JSON.stringify(req.body))
        : 'No report available.',
    });
  }
  res.status(204).json();
};

// Future push: restore renderServiceWorkerConfig (previously served
// `var FCM_SENDER_ID = …` at GET /config/sw.js) when browser push returns.

service.getLanguages = (req, res) => {
  // Return language list in array format
  if (req?.query?.format === 'array') {
    return res.json(
      languagesArray.map(language => ({
        ...language,
        deprecated: deprecatedLanguages.has(language.value),
      })),
    );
  }

  // Return language list in object format
  res.json(languagesObject);
};

const defaultExport = service;
export default defaultExport;
export const getLanguages = defaultExport.getLanguages;
export const receiveCSPViolationReport =
  defaultExport.receiveCSPViolationReport;
export const receiveExpectCTViolationReport =
  defaultExport.receiveExpectCTViolationReport;
export const renderIndex = defaultExport.renderIndex;
export const renderNotFound = defaultExport.renderNotFound;
