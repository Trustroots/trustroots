const config = require('../../../../config/config.mts').default;
const targetedRequestLimit =
  require('../../../core/server/middleware/targeted-request-limit.server.middleware.mts').default;
const {
  listPendingTranslationAlerts,
  newTranslationAlertChallenge,
  registerTranslationAlert,
  unregisterTranslationAlert,
} = require('../services/nostranslation-alert-registration.server.service.mts');
const {
  translationAlertConfiguration,
} = require('../services/nostranslation-alert-transport.server.service.mts');

function registrationScope(req) {
  return {
    user: req.mobileUser._id,
    session: req.mobileSession._id,
    refreshExpiresAt: req.mobileSession.refreshExpiresAt,
  };
}

exports.allowWrite = function (req, res, next) {
  if (!config.featureFlags.nostranslationAlerts) return res.sendStatus(404);
  return targetedRequestLimit.nostranslationAlertWrite(req, res, next);
};

exports.challenge = async function (req, res) {
  const event = await newTranslationAlertChallenge(
    registrationScope(req),
    req.body,
  );
  if (!event)
    return res
      .status(400)
      .json({ message: 'Invalid notification registration.' });
  return res.json({ event });
};

exports.configuration = function (_req, res) {
  return res.json(
    config.featureFlags.nostranslationAlerts
      ? translationAlertConfiguration()
      : { androidVapidKey: null, ios: false },
  );
};

exports.register = async function (req, res) {
  const accepted = await registerTranslationAlert(
    registrationScope(req),
    req.body,
  );
  if (!accepted)
    return res
      .status(400)
      .json({ message: 'Invalid notification registration proof.' });
  return res.status(204).end();
};

exports.unregister = async function (req, res) {
  const accepted = await unregisterTranslationAlert(
    registrationScope(req),
    req.body?.transport,
  );
  if (!accepted)
    return res.status(400).json({ message: 'Invalid transport key.' });
  return res.status(204).end();
};

exports.pending = async function (req, res) {
  if (!config.featureFlags.nostranslationAlerts) return res.sendStatus(404);
  const events = await listPendingTranslationAlerts(
    registrationScope(req),
    req.body?.transport,
  );
  if (!events)
    return res.status(400).json({ message: 'Invalid transport key.' });
  return res.json({ events });
};
