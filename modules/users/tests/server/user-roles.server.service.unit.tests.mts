import {
  hasAnyRole,
  hasRestrictedMessagingRole,
  hasRole,
} from '../../server/services/user-roles.server.service.mts';

describe('Service: user roles', function () {
  it('finds a role the user has', function () {
    hasRole({ roles: ['user', 'admin'] }, 'admin').should.be.true();
    hasRole({ roles: ['user'] }, 'admin').should.be.false();
  });

  it('treats a missing user or missing roles as having none', function () {
    hasRole(null, 'user').should.be.false();
    hasRole(undefined, 'user').should.be.false();
    hasRole({}, 'user').should.be.false();
    hasAnyRole(null, ['user']).should.be.false();
    hasAnyRole({}, ['user']).should.be.false();
  });

  it('matches any of several roles', function () {
    hasAnyRole({ roles: ['user', 'moderator'] }, [
      'admin',
      'moderator',
    ]).should.be.true();
    hasAnyRole({ roles: ['user'] }, ['admin', 'moderator']).should.be.false();
  });

  it('flags restricted messaging roles', function () {
    hasRestrictedMessagingRole({ roles: ['shadowban'] }).should.be.true();
    hasRestrictedMessagingRole({ roles: ['suspended'] }).should.be.true();
    hasRestrictedMessagingRole({ roles: ['user'] }).should.be.false();
  });
});
