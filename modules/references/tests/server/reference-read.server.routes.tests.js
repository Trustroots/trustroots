describe('Read references by userFrom Id or userTo Id', function () {
  // GET /references?userFrom=:UserId&userTo=:UserId

  // logged in public user can read all public references by userFrom
  // logged in public user can read all public references by userTo
  // logged in public user can read all public and private references from self
  // logged in public user can not read private references to self
  // logged in public user can read a specific reference by specifying userFrom and userTo
  // when userFrom or userTo doesn't exist, we simply return empty list
  context('logged in as public user', function () {
    it('[param userFrom] respond with all public references from userFrom');
    it('[param userTo] respond with all public references to userTo');
    it('[params userFrom and userTo] respond with 1 or 0 public reference from userFrom to userTo');
    it('[userFrom is self] display all public and private references from userFrom');
    it('[no params] 400 and error');
  });

  context('logged in as non-public user', function () {
    it('403');
  });

  context('not logged in', function () {
    it('403');
  });
});

describe('Read a single reference by reference id', function () {
  // GET /references/:referenceId
  // logged in public user can read a single public reference by id
  // .....                 can read a single private reference if it is from self
  // logged in public user can not read other private references
  context('logged in as public user', function () {
    it('read a single public reference by id');
    it('read a single private reference if it is from self');
    it('can not read private references other than from self');
  });

  context('logged in as non-public user', function () {
    it('403');
  });

  context('not logged in', function () {
    it('403');
  });
});
