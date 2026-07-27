const mobileAuthentication = require('../controllers/mobile-authentication.server.controller');
const mobileAuthenticationThrottle = require('../middleware/mobile-authentication-throttle.server.middleware');
const offers = require('../../../offers/server/controllers/offers.server.controller');
const tribes = require('../../../tribes/server/controllers/tribes.server.controller');
const userProfile = require('../../../users/server/controllers/users.profile.server.controller');
const contacts = require('../../../contacts/server/controllers/contacts.server.controller');
const experiences = require('../../../experiences/server/controllers/experiences.server.controller');
const messages = require('../../../messages/server/controllers/messages.server.controller');
const support = require('../../../support/server/controllers/support.server.controller');
const userPassword = require('../../../users/server/controllers/users.password.server.controller');

module.exports = function (app) {
  app.route('/api/mobile/v0/status').get(mobileAuthentication.status);
  app
    .route('/api/mobile/v0/auth/signin')
    .post(mobileAuthenticationThrottle.signin, mobileAuthentication.signin);
  app
    .route('/api/mobile/v0/auth/refresh')
    .post(mobileAuthenticationThrottle.refresh, mobileAuthentication.refresh);
  app
    .route('/api/mobile/v0/auth/signout')
    .post(mobileAuthentication.authenticate, mobileAuthentication.signout);
  app
    .route('/api/mobile/v0/me')
    .get(mobileAuthentication.authenticate, mobileAuthentication.me);
  app
    .route('/api/mobile/v0/profiles/:profileUsername')
    .get(
      mobileAuthentication.authenticate,
      mobileAuthentication.loadProfile,
      mobileAuthentication.profile,
    );

  // These routes deliberately reuse the established domain controllers while
  // the mobile API establishes its own representations. Authentication is
  // always the bearer middleware above: no browser-session cookie is read.
  app
    .route('/api/mobile/v0/offers')
    .get(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      offers.list,
    );
  app.route('/api/mobile/v0/offers/:mobileOfferId').get(
    mobileAuthentication.authenticate,
    mobileAuthentication.prepareResource,
    function (req, res, next) {
      return offers.offerById(req, res, next, req.params.mobileOfferId);
    },
    offers.getOffer,
  );
  app
    .route('/api/mobile/v0/circles')
    .get(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      tribes.listTribes,
    );
  app
    .route('/api/mobile/v0/memberships')
    .get(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      userProfile.getUserMemberships,
    );
  app
    .route('/api/mobile/v0/memberships/:tribeId')
    .post(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      userProfile.joinTribe,
    )
    .delete(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      userProfile.leaveTribe,
    );

  app.route('/api/mobile/v0/contacts/:memberId').get(
    mobileAuthentication.authenticate,
    mobileAuthentication.prepareResource,
    function (req, res, next) {
      return contacts.contactListByUser(req, res, next, req.params.memberId);
    },
    contacts.list,
  );
  app
    .route('/api/mobile/v0/experiences')
    .get(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      experiences.readMany,
    )
    .post(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      experiences.create,
    );
  app
    .route('/api/mobile/v0/experiences/with/:memberId')
    .get(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      function (req, res, next) {
        req.query.userWith = req.params.memberId;
        return experiences.readMine(req, res, next);
      },
    );

  app
    .route('/api/mobile/v0/messages')
    .get(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      messages.inbox,
    )
    .post(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      messages.send,
    );
  app.route('/api/mobile/v0/messages/:memberId').get(
    mobileAuthentication.authenticate,
    mobileAuthentication.prepareResource,
    function (req, res, next) {
      return messages.threadByUser(req, res, next, req.params.memberId);
    },
    messages.thread,
  );
  app
    .route('/api/mobile/v0/account')
    .put(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      userProfile.update,
    );
  app
    .route('/api/mobile/v0/profile')
    .put(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      userProfile.update,
    );
  app
    .route('/api/mobile/v0/account/password')
    .post(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      userPassword.changePassword,
    );
  app
    .route('/api/mobile/v0/support')
    .post(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      support.supportRequest,
    );
};
