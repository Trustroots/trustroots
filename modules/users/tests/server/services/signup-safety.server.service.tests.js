const signupSafety = require('../../../server/services/signup-safety.server.service');
require('should');

describe('Signup safety service', () => {
  it('matches each configured keyword case-insensitively', () => {
    signupSafety
      .matchSignupProfile({
        firstName: 'TrustRoots',
        lastName: 'System',
        displayName: 'Support volunteer',
        username: 'ordinary-member',
      })
      .should.deepEqual(['support', 'system', 'trustroots']);
  });

  it('does not inspect passwords or flag unrelated identifying text', () => {
    signupSafety
      .matchSignupProfile({
        firstName: 'Mira',
        lastName: 'Example',
        displayName: 'Mira Example',
        username: 'mira-example',
        password: 'trustroots',
      })
      .should.deepEqual([]);
  });
});
