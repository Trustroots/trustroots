const contacts = require('../../../contacts/server/controllers/contacts.server.controller');
const offers = require('../../../offers/server/controllers/offers.server.controller');
const profiles = require('./users.profile.server.controller');

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

exports.download = async function (req, res, next) {
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

exports.EXPORT_FILENAME = EXPORT_FILENAME;
