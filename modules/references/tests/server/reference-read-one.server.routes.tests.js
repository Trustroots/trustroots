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
