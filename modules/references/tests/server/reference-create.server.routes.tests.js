describe('Create a reference', function () {

  // user can leave a reference to anyone
  //  - types of interaction
  //  - recommend
  //  - from whom
  //  - to whom
  // POST /references
  // reference can't be modified or removed
  // email notification will be sent to the receiver of the reference
  // the receiver has some time to give a reference, too.
  // after this time the only accepted answers are yes/ignore.
  // after the given time or after both left reference, both references become public

  context('logged in', function () {
    context('valid request', function () {

      context('every reference', function () {
        it('respond with 201 Created and the new reference in body');
        it('save reference to database with proper fields');
        it('[duplicate reference between these people] 409 Conflict');
        it('[sending a reference to self] 400');
        it('[sending a reference to nonexistent user] 404');
      });

      context('initial reference', function () {
        it('the reference is private');
        it('send email notification to target user');
      });

      context('reply reference', function () {
        it('[late] only positive recommendation is allowed');
        it('set both references as public');
        it('send email notification (maybe)');
      });
    });

    context('invalid request', function () {
      it('[invalid value in interaction types] 400');
      it('[invalid recommendation] 400');
      it('[invalid receiver id] 400');
      it('[missing fields] 400');
      it('[unexpected fields] 400');
    });
  });

  context('logged in as non-public user', function () {
    it('403');
  });

  context('not logged in', function () {
    it('403');
  });
});
