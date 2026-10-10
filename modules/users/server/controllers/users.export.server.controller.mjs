import contacts from './../../../contacts/server/controllers/contacts.server.controller.mjs';
import offers from './../../../offers/server/controllers/offers.server.controller.mjs';
import profiles from './users.profile.server.controller.mjs';
import log from './../../../../config/lib/logger.mjs';
import * as canonical from '../services/data-export-canonical.server.service.mjs';
import * as signing from '../services/data-export-signing.server.service.mjs';

const service = {};
const EXPORT_FILENAME = 'trustroots-data.json';
function invokeMiddleware(middleware, req, value) {
  return new Promise((resolve, reject) => {
    const response = {
      status(code) {
        return {
          send(body) {
            const error = new Error(body && body.message);
            error.statusCode = code;
            reject(error);
          },
        };
      },
    };
    middleware(
      req,
      response,
      error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      },
      value,
    );
  });
}
service.download = async function (req, res, next) {
  try {
    await invokeMiddleware(profiles.userByUsername, req, req.user.username);
    await invokeMiddleware(contacts.contactListByUser, req, req.user._id);
    let hostingOffers = [];
    try {
      await invokeMiddleware(offers.offersByUserId, req, req.user._id);
      hostingOffers = req.offers || [];
    } catch (error) {
      if (error.statusCode !== 404) {
        throw error;
      }
    }

    // Everything the signature covers is built first and sent verbatim, so
    // that the delivered bytes canonicalise to exactly what was signed.
    const payload = canonical.buildSignedPayload({
      profile: req.profile,
      contacts: req.contacts,
      hostingOffers,
    });

    const signature = signing.signPayload(payload, {
      username: req.user.username,
    });

    if (!signature) {
      log(
        'warn',
        'No data export signing key configured; serving an unsigned export #k2Nd8s',
      );
    }

    res
      .type('application/json')
      .attachment(EXPORT_FILENAME)
      .send({
        ...payload,
        // Request-time metadata, deliberately outside the signed payload: it
        // differs on every download and would make the signature cover
        // something other than the member's data.
        exportedAt: new Date().toISOString(),
        signature,
      });
  } catch (error) {
    next(error);
  }
};
service.EXPORT_FILENAME = EXPORT_FILENAME;
const defaultExport = service;
export default defaultExport;
export { EXPORT_FILENAME };
export const download = defaultExport.download;
export { defaultExport as 'module.exports' };
