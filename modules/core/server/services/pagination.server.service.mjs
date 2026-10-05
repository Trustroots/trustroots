import config from '../../../../config/config.mjs';
import paginate from 'express-paginate';

/**
 * Set a `Link` header for the next page when one exists.
 *
 * Requires `express-paginate` middleware to have run for the request so
 * that `res.locals.paginate` is available.
 *
 * @param req Object Express request
 * @param res Object Express response
 * @param pageCount Number Total number of pages
 * @param options Object Link formatting options
 * @param options.relative Boolean Keep the link relative to the current site
 */
export function setLinkHeader(req, res, pageCount, { relative = false } = {}) {
  if (paginate.hasNextPages(req)(pageCount)) {
    const url = (config.https ? 'https' : 'http') + '://' + config.domain;
    const href = res.locals.paginate.href({
      page: Number(req.query.page) + 1,
    });
    res.links({
      next: relative ? href : url + href,
    });
  }
}

const service = {
  setLinkHeader,
};
export default service;
export { service as 'module.exports' };
