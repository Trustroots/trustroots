import contacts from '../../../contacts/server/controllers/contacts.server.controller.js';
import offers from '../../../offers/server/controllers/offers.server.controller.js';
import profiles from './users.profile.server.controller.js';

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

    res
      .type('application/json')
      .attachment(EXPORT_FILENAME)
      .send({
        format: 'trustroots-data-export',
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: req.profile || {},
        contacts: req.contacts || [],
        hostingOffers,
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
