import config from '../../../../config/config.mjs';
import qs from 'qs';
interface PaginationRequest {
  query: Record<string, unknown>;
  originalUrl: string;
  skip?: number;
  offset?: number;
}
interface PaginationResponse {
  locals: { paginate?: { href(params: Record<string, unknown>): string } };
  links(links: Record<string, string>): unknown;
}

/** Normalise pagination once so database queries and Link headers agree. */
export function middleware(limit: number, maxLimit: number) {
  return (
    req: PaginationRequest,
    res: Pick<PaginationResponse, 'locals'>,
    next: () => void,
  ) => {
    req.query.page =
      typeof req.query.page === 'string'
        ? parseInt(req.query.page, 10) || 1
        : 1;
    req.query.limit =
      typeof req.query.limit === 'string'
        ? parseInt(req.query.limit, 10) || 0
        : limit;
    req.query.page = Math.max(1, req.query.page as number);
    req.query.limit = Math.max(
      0,
      Math.min(maxLimit, req.query.limit as number),
    );
    req.skip = req.offset =
      ((req.query.page as number) - 1) * (req.query.limit as number);
    res.locals.paginate = {
      href: (params: Record<string, unknown>) =>
        req.originalUrl.split('?')[0] +
        '?' +
        qs.stringify({ ...req.query, ...params }),
    };
    next();
  };
}

/**
 * Set a `Link` header for the next page when one exists.
 *
 * Requires pagination middleware to have run for the request so
 * that `res.locals.paginate` is available.
 *
 * @param req Object Express request
 * @param res Object Express response
 * @param pageCount Number Total number of pages
 * @param options Object Link formatting options
 * @param options.relative Boolean Keep the link relative to the current site
 */
export function setLinkHeader(
  req: Pick<PaginationRequest, 'query'>,
  res: PaginationResponse,
  pageCount: number,
  { relative = false }: { relative?: boolean } = {},
) {
  if ((req.query.page as number) < pageCount) {
    const url = (config.https ? 'https' : 'http') + '://' + config.domain;
    const href = res.locals.paginate!.href({
      page: Number(req.query.page) + 1,
    });
    res.links({
      next: relative ? href : url + href,
    });
  }
}

const service = {
  middleware,
  setLinkHeader,
};
export default service;
export { service as 'module.exports' };
