import contacts from './../../../contacts/server/controllers/contacts.server.controller.mjs';
import offers from './../../../offers/server/controllers/offers.server.controller.mjs';
import profiles from './users.profile.server.controller.mjs';
const service = {};
const EXPORT_USERNAME = /^(?=.*[0-9a-z])[0-9a-z.\-_]{3,34}$/;

function formatExportStamp(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
}

function buildExportFilename(username, exportedAt) {
  const stamp = formatExportStamp(exportedAt);
  const safeUsername = String(username || '').toLowerCase();
  if (EXPORT_USERNAME.test(safeUsername)) {
    return `trustroots-data-${safeUsername}-${stamp}.json`;
  }
  return `trustroots-data-${stamp}.json`;
}

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
    const exportedAt = new Date();
    res
      .type('application/json')
      .attachment(buildExportFilename(req.user.username, exportedAt))
      .send({
        format: 'trustroots-data-export',
        version: 1,
        exportedAt: exportedAt.toISOString(),
        profile: req.profile || {},
        contacts: req.contacts || [],
        hostingOffers,
      });
  } catch (error) {
    next(error);
  }
};
service.buildExportFilename = buildExportFilename;
const defaultExport = service;
export default defaultExport;
export { buildExportFilename };
export const download = defaultExport.download;
export { defaultExport as 'module.exports' };
