const {
  isReactOwnedPath,
  normalizePath,
  REACT_OWNED_PATHS,
} = require('../../shared/react-route-ownership');

require('should');

describe('React route ownership', function () {
  it('lists the first React-owned route group', function () {
    REACT_OWNED_PATHS.should.containEql('/support');
    REACT_OWNED_PATHS.should.containEql('/statistics');
    REACT_OWNED_PATHS.should.containEql('/faq/technology');
  });

  it('normalizes paths for server route selection', function () {
    normalizePath('/support/?report=alice').should.equal('/support');
    isReactOwnedPath('/support/?report=alice').should.be.true();
  });

  it('does not claim Angular-owned routes', function () {
    isReactOwnedPath('/profile/alice').should.be.false();
  });
});
