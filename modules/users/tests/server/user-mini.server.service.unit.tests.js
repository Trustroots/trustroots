const userMiniService = require('../../server/services/user-mini.server.service');
const userRolesService = require('../../server/services/user-roles.server.service');

require('should');

describe('Service: user mini', function () {
  it('can be imported by ESM controllers', async function () {
    const esmService = await import(
      '../../server/services/user-mini.server.service.js'
    );
    esmService.default.should.equal(userMiniService);
  });

  describe('userMiniProfileFields', function () {
    it('lists exactly the mini profile fields', function () {
      userMiniService.userMiniProfileFields.should.equal(
        [
          'id',
          'updated',
          'displayName',
          'username',
          'avatarSource',
          'avatarUploaded',
          'avatarVersion',
          'emailHash',
          'additionalProvidersData.facebook.id',
        ].join(' '),
      );
    });
  });

  describe('userMiniProjectionMap', function () {
    it('returns the inclusion map for mini profile fields', function () {
      userMiniService.userMiniProjectionMap().should.eql({
        _id: 1,
        updated: 1,
        displayName: 1,
        username: 1,
        avatarSource: 1,
        avatarUploaded: 1,
        avatarVersion: 1,
        emailHash: 1,
        additionalProvidersData: {
          facebook: {
            id: 1,
          },
        },
      });
    });

    it('extends the map with extra fields', function () {
      const map = userMiniService.userMiniProjectionMap({ created: 1 });
      map.should.have.property('created', 1);
      map.should.have.property('username', 1);
    });
  });

  describe('userMiniProjection', function () {
    it('returns the nested projection for the default prefix', function () {
      const projection = userMiniService.userMiniProjection();
      projection.should.eql({
        _id: '$user._id',
        updated: '$user.updated',
        displayName: '$user.displayName',
        username: '$user.username',
        avatarSource: '$user.avatarSource',
        avatarUploaded: '$user.avatarUploaded',
        avatarVersion: '$user.avatarVersion',
        emailHash: '$user.emailHash',
        additionalProvidersData: {
          facebook: {
            id: '$user.additionalProvidersData.facebook.id',
          },
        },
      });
    });

    it('uses the given prefix and extends with extra fields', function () {
      const projection = userMiniService.userMiniProjection('$user', {
        locationFrom: '$user.locationFrom',
      });
      projection.should.have.property('_id', '$user._id');
      projection.should.have.property('locationFrom', '$user.locationFrom');
      projection.additionalProvidersData.should.eql({
        facebook: {
          id: '$user.additionalProvidersData.facebook.id',
        },
      });
    });
  });

  describe('miniUserPopulate', function () {
    it('returns populate options for mini profile fields', function () {
      userMiniService.miniUserPopulate('userFrom userTo').should.eql({
        path: 'userFrom userTo',
        select: userMiniService.userMiniProfileFields,
        model: 'User',
      });
    });

    it('drops restricted roles when asked to', function () {
      const populate = userMiniService.miniUserPopulate('userTo', {
        excludeRestrictedRoles: true,
      });
      populate.match.should.eql({
        roles: { $nin: userRolesService.restrictedMessagingRoles },
      });
    });
  });

  describe('visibleUserLookupStages', function () {
    it('joins the user and drops restricted roles', function () {
      userMiniService
        .visibleUserLookupStages({ localField: 'user', as: 'user' })
        .should.eql([
          {
            $lookup: {
              from: 'users',
              localField: 'user',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: '$user' },
          {
            $match: {
              'user.roles': {
                $nin: userRolesService.restrictedMessagingRoles,
              },
            },
          },
        ]);
    });
  });
});
