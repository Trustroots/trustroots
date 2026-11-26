import { readFileSync } from 'node:fs';
import errorService from './../services/error.server.service.mts';
import textService from './../services/text.server.service.mts';
import {
  getStartShell,
  renderStartShell,
} from './../services/start-shell.server.service.mts';
import log from '@trustroots/logger';
import deprecatedLanguages from './../../../../config/languages/deprecated.mts';
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
export type BootstrapUser = {
  roles?: readonly string[];
  username?: string;
  _id?: unknown;
};
export type BuildBootstrapUser = (user: unknown) => BootstrapUser | undefined;

type IndexRequest = {
  path: string;
  user?: unknown;
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
  locals: { nonce: string };
  render(
    view: string,
    variables: BootstrapVariables,
    callback: (error: Error | null, html: string) => void,
  ): unknown;
  json(value?: unknown): unknown;
  send(value: string): unknown;
};
const service = {
  renderIndex,
  renderNotFound,
  receiveCSPViolationReport,
  getLanguages,
};

/**
 * Render the main application page
 */
async function renderIndex(
  buildBootstrapUser: BuildBootstrapUser,
  req: IndexRequest,
  res: CoreResponse,
  next: (error: unknown) => void,
) {
  const renderVars: BootstrapVariables = {
    user: null,
  };

  // Expose user
  if (req.user) {
    renderVars.user = buildBootstrapUser(req.user);
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
  // The client routes apply their own redirects and access rules.
  const shell = await getStartShell();
  res.render('index', renderVars, (error, head) => {
    if (error) return next(error);
    res.send(renderStartShell(shell, head, res.locals.nonce));
  });
}

/**
 * Render the server not found responses
 * Performs content-negotiation on the Accept HTTP header; browsers get the
 * app, whose router shows its not-found page.
 */
function renderNotFound(
  buildBootstrapUser: BuildBootstrapUser,
  req: IndexRequest,
  res: CoreResponse,
  next: (error: unknown) => void,
) {
  res.status(404).format({
    'text/html'() {
      void renderIndex(buildBootstrapUser, req, res, next).catch(next);
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
 * See `config/lib/security-headers.mts` and `initSecurityHeaders()` for more
 */
function receiveCSPViolationReport(req: { body?: unknown }, res: CoreResponse) {
  if (process.env.NODE_ENV !== 'test') {
    log('warn', 'CSP violation report #ljeanw', {
      report: req.body
        ? textService.plainText(JSON.stringify(req.body))
        : // Stryker disable next-line StringLiteral: the logger redacts every `report` value, so the placeholder is never visible
          'No report available.',
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
export default service;
/** @esmNamed */
export { getLanguages, receiveCSPViolationReport, renderIndex, renderNotFound };
