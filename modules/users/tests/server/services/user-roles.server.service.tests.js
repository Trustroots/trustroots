const userRoles = require('../../../server/services/user-roles.server.service');

require('should');

describe('Service: user-roles', function () {
  describe('hasRole', function () {
    it('returns true when the user has the role', function () {
      userRoles.hasRole({ roles: ['user', 'admin'] }, 'admin').should.be.true();
    });

    it('returns false when the user lacks the role', function () {
      userRoles.hasRole({ roles: ['user'] }, 'admin').should.be.false();
    });

    it('returns false when the user has no roles defined', function () {
      userRoles.hasRole({}, 'admin').should.be.false();
    });
  });

  describe('hasAnyRole', function () {
    it('returns true when the user has at least one of the roles', function () {
      userRoles
        .hasAnyRole({ roles: ['user', 'suspended'] }, [
          'suspended',
          'shadowban',
        ])
        .should.be.true();
    });

    it('returns false when the user has none of the roles', function () {
      userRoles
        .hasAnyRole({ roles: ['user'] }, ['suspended', 'shadowban'])
        .should.be.false();
    });
  });

  describe('hasRestrictedMessagingRole', function () {
    it('returns true for suspended users', function () {
      userRoles
        .hasRestrictedMessagingRole({ roles: ['user', 'suspended'] })
        .should.be.true();
    });

    it('returns true for shadowbanned users', function () {
      userRoles
        .hasRestrictedMessagingRole({ roles: ['user', 'shadowban'] })
        .should.be.true();
    });

    it('returns false for regular users', function () {
      userRoles
        .hasRestrictedMessagingRole({ roles: ['user'] })
        .should.be.false();
    });
  });

  it('exposes the list of restricted messaging roles', function () {
    userRoles.restrictedMessagingRoles.should.deepEqual([
      'suspended',
      'shadowban',
    ]);
  });
});
