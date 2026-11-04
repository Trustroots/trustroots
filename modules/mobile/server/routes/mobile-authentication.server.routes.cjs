const mobileAuthentication = require('../controllers/mobile-authentication.server.controller.cjs');
const mobileAuthenticationThrottle = require('../middleware/mobile-authentication-throttle.server.middleware.cjs');
const offers = require('../../../offers/server/controllers/offers.server.controller.mjs');
const tribes = require('../../../tribes/server/controllers/tribes.server.controller.mjs');
const userProfile = require('../../../users/server/controllers/users.profile.server.controller.mjs');
const contacts = require('../../../contacts/server/controllers/contacts.server.controller.mjs');
const experiences = require('../../../experiences/server/controllers/experiences.server.controller.mjs');
const messages = require('../../../messages/server/controllers/messages.server.controller.mjs');
const support = require('../../../support/server/controllers/support.server.controller.mjs');
const userPassword = require('../../../users/server/controllers/users.password.server.controller.mjs');
const resourcePolicy = require('../middleware/mobile-resource-policy.server.middleware.cjs');
const offersPolicy = require('../../../offers/server/policies/offers.server.policy.mts');
const tribesPolicy = require('../../../tribes/server/policies/tribes.server.policy.mts');
const usersPolicy = require('../../../users/server/policies/users.server.policy.mts');
const contactsPolicy = require('../../../contacts/server/policies/contacts.server.policy.mts');
const experiencesPolicy = require('../../../experiences/server/policies/experiences.server.policy.mts');
const messagesPolicy = require('../../../messages/server/policies/messages.server.policy.mts');
const userBlock = require('../../../users/server/controllers/users.block.server.controller.mjs');
const userAvatar = require('../../../users/server/controllers/users.avatar.server.controller.mjs');
const unifiedPush = require('../../../users/server/controllers/users.unified-push.server.controller.mjs');

module.exports = function (app) {
  app
    .route('/api/mobile/v0/users/unified-push')
    .all(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(usersPolicy.isAllowed, '/api/users/unified-push'),
    )
    .get(unifiedPush.configuration)
    .post(unifiedPush.add)
    .delete(unifiedPush.remove);
  app.route('/api/mobile/v0/members/:mobileMemberId').get(
    mobileAuthentication.authenticate,
    mobileAuthentication.prepareResource,
    function (req, res, next) {
      return userProfile.userMiniByID(
        req,
        res,
        next,
        req.params.mobileMemberId,
      );
    },
    resourcePolicy(usersPolicy.isAllowed, '/api/users/mini/:userId'),
    userProfile.getMiniUser,
  );
  app.route('/api/mobile/v0/contact-by/:mobileContactUserId').get(
    mobileAuthentication.authenticate,
    mobileAuthentication.prepareResource,
    function (req, res, next) {
      return contacts.contactByUserId(
        req,
        res,
        next,
        req.params.mobileContactUserId,
      );
    },
    resourcePolicy(contactsPolicy.isAllowed, '/api/contact-by/:contactUserId'),
    contacts.get,
  );
  app.route('/api/mobile/v0/contact/:mobileContactId').delete(
    mobileAuthentication.authenticate,
    mobileAuthentication.prepareResource,
    function (req, res, next) {
      return contacts.contactById(req, res, next, req.params.mobileContactId);
    },
    resourcePolicy(contactsPolicy.isAllowed, '/api/contact/:contactId'),
    contacts.remove,
  );
  app
    .route('/api/mobile/v0/members')
    .get(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(usersPolicy.isAllowed, '/api/users'),
      userProfile.search,
    );
  app.route('/api/mobile/v0/members/:mobileAvatarId/avatar').get(
    mobileAuthentication.authenticate,
    mobileAuthentication.prepareResource,
    function (req, res, next) {
      return userAvatar.userForAvatarByUserId(
        req,
        res,
        next,
        req.params.mobileAvatarId,
      );
    },
    resourcePolicy(usersPolicy.isAllowed, '/api/users/:avatarUserId/avatar'),
    userAvatar.getAvatar,
  );
  app.route('/api/mobile/v0/offers-by/:mobileOfferUserId').get(
    mobileAuthentication.authenticate,
    mobileAuthentication.prepareResource,
    resourcePolicy(offersPolicy.isAllowed, '/api/offers-by/:offerUserId'),
    function (req, res, next) {
      return offers.offersByUserId(
        req,
        res,
        next,
        req.params.mobileOfferUserId,
      );
    },
    offers.listOffersByUser,
  );
  app
    .route('/api/mobile/v0/blocked-users')
    .get(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(usersPolicy.isAllowed, '/api/blocked-users'),
      userBlock.getBlockedUsers,
    );
  app
    .route('/api/mobile/v0/blocked-users/:profileUsername')
    .all(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      mobileAuthentication.loadProfile,
      resourcePolicy(usersPolicy.isAllowed, '/api/blocked-users/:username'),
    )
    .put(userBlock.blockUser)
    .delete(userBlock.unblockUser);
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
      mobileAuthentication.prepareResource,
      mobileAuthentication.loadProfile,
      resourcePolicy(usersPolicy.isAllowed, '/api/users/:username'),
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
      resourcePolicy(offersPolicy.isAllowed, '/api/offers'),
      offers.list,
    )
    .post(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(offersPolicy.isAllowed, '/api/offers'),
      offers.create,
    );
  app
    .route('/api/mobile/v0/offers/:mobileOfferId')
    .all(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(offersPolicy.isAllowed, '/api/offers/:offerId'),
      function (req, res, next) {
        return offers.offerById(req, res, next, req.params.mobileOfferId);
      },
    )
    .get(offers.getOffer)
    .put(offers.update);
  app
    .route('/api/mobile/v0/circles')
    .get(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(tribesPolicy.isAllowed, '/api/tribes'),
      tribes.listTribes,
    );
  app.route('/api/mobile/v0/circles/:slug').get(
    mobileAuthentication.authenticate,
    mobileAuthentication.prepareResource,
    function (req, res, next) {
      req.params.tribe = req.params.slug;
      return resourcePolicy(tribesPolicy.isAllowed, '/api/tribes/:tribe')(
        req,
        res,
        next,
      );
    },
    function (req, res, next) {
      return tribes.tribeBySlug(req, res, next, req.params.tribe);
    },
    tribes.getTribe,
  );
  app.route('/api/mobile/v0/circles/:slug/members').get(
    mobileAuthentication.authenticate,
    mobileAuthentication.prepareResource,
    function (req, res, next) {
      req.params.tribe = req.params.slug;
      return resourcePolicy(
        tribesPolicy.isAllowed,
        '/api/tribes/:tribe/members',
      )(req, res, next);
    },
    function (req, res, next) {
      return tribes.tribeBySlug(req, res, next, req.params.tribe);
    },
    tribes.listMembers,
  );
  app
    .route('/api/mobile/v0/memberships')
    .get(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(usersPolicy.isAllowed, '/api/users/memberships'),
      userProfile.getUserMemberships,
    );
  app
    .route('/api/mobile/v0/memberships/:tribeId')
    .post(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(usersPolicy.isAllowed, '/api/users/memberships/:tribeId'),
      userProfile.joinTribe,
    )
    .delete(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(usersPolicy.isAllowed, '/api/users/memberships/:tribeId'),
      userProfile.leaveTribe,
    );

  app.route('/api/mobile/v0/contacts/:memberId').get(
    mobileAuthentication.authenticate,
    mobileAuthentication.prepareResource,
    resourcePolicy(contactsPolicy.isAllowed, '/api/contacts/:listUserId'),
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
      resourcePolicy(experiencesPolicy.isAllowed, '/api/experiences'),
      experiences.readMany,
    )
    .post(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(experiencesPolicy.isAllowed, '/api/experiences'),
      experiences.create,
    );
  app
    .route('/api/mobile/v0/experiences/with/:memberId')
    .get(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(experiencesPolicy.isAllowed, '/api/my-experience'),
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
      resourcePolicy(messagesPolicy.isAllowed, '/api/messages'),
      messages.inbox,
    )
    .post(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(messagesPolicy.isAllowed, '/api/messages'),
      messages.send,
    );
  app.route('/api/mobile/v0/messages/:memberId').get(
    mobileAuthentication.authenticate,
    mobileAuthentication.prepareResource,
    resourcePolicy(messagesPolicy.isAllowed, '/api/messages/:messageUserId'),
    function (req, res, next) {
      return messages.threadByUser(
        req,
        res,
        next,
        req.params.memberId,
        req.query.markRead !== 'false',
      );
    },
    messages.thread,
  );
  app
    .route('/api/mobile/v0/messages-read')
    .post(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(messagesPolicy.isAllowed, '/api/messages-read'),
      mobileAuthentication.validateMessageIds,
      messages.markRead,
    );
  app
    .route('/api/mobile/v0/account')
    .put(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(usersPolicy.isAllowed, '/api/users'),
      userProfile.update,
    );
  app
    .route('/api/mobile/v0/profile')
    .put(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(usersPolicy.isAllowed, '/api/users'),
      userProfile.update,
    );
  app
    .route('/api/mobile/v0/account/password')
    .post(
      mobileAuthentication.authenticate,
      mobileAuthentication.prepareResource,
      resourcePolicy(usersPolicy.isAllowed, '/api/users/password'),
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
