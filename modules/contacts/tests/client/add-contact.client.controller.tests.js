import '@/modules/contacts/client/contacts.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ContactAddController', function () {
  // Initialize global variables
  let $httpBackend;
  let Authentication;
  let UsersMini;
  let ContactByService;
  let ContactAddController;

  const user1 = {
    _id: 'user1',
    displayName: 'User One',
  };

  const user2 = {
    _id: 'user2',
    displayName: 'User Two',
  };

  const contactRequest = {
    friendUserId: user2._id,
    message:
      '<p>Hi!</p><p>I would like to add you as a contact.</p><p>- ' +
      user1.displayName +
      '</p>',
  };

  // Load the main application module
  beforeEach(function (done) {
    angular.mock.module(AppConfig.appModuleName);
    done();
  });

  beforeEach(function (done) {
    inject(function (
      _$httpBackend_,
      _Authentication_,
      _UsersMini_,
      _ContactByService_,
    ) {
      $httpBackend = _$httpBackend_;
      Authentication = _Authentication_;
      UsersMini = _UsersMini_;
      ContactByService = _ContactByService_;
      done();
    });
  });

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  describe('logged in', function () {
    beforeEach(function (done) {
      inject(function ($controller) {
        Authentication.user = user1;

        ContactAddController = $controller('ContactAddController', {
          friend: UsersMini.get({ userId: user2._id }),
          existingContact: ContactByService.get({ userId: user2._id }),
          $stateParams: { userId: user2._id },
        });

        done();
      });
    });

    describe('when user does not exist', function () {
      beforeEach(function () {
        $httpBackend.expect('GET', '/api/users/mini/user2').respond(404);
        $httpBackend.expect('GET', '/api/contact-by/user2').respond(404);
      });

      it('displays an error message', function () {
        $httpBackend.flush();
        expect(ContactAddController.error).toBe('User does not exist.');
      });
    });

    describe('when user exists', function () {
      beforeEach(function () {
        $httpBackend.expect('GET', '/api/users/mini/user2').respond(200, user2);
      });

      describe('when unconfirmed contact exists', function () {
        beforeEach(function () {
          $httpBackend
            .expect('GET', '/api/contact-by/user2')
            .respond(200, { confirmed: false });
        });

        it('displays a success message', function () {
          $httpBackend.flush();
          expect(ContactAddController.success).toBe(
            'Connection already initiated; now it has to be confirmed.',
          );
        });
      });

      describe('when confirmed contact exists', function () {
        beforeEach(function () {
          $httpBackend
            .expect('GET', '/api/contact-by/user2')
            .respond(200, { confirmed: true });
        });

        it('Shows a nice message when the contact is confirmed', function () {
          $httpBackend.flush();
          expect(ContactAddController.success).toBe(
            'You two are already connected. Great!',
          );
        });
      });

      describe('when no contact exists', function () {
        beforeEach(function () {
          $httpBackend.expect('GET', '/api/contact-by/user2').respond(404);
        });

        it('will make contact request', function () {
          $httpBackend
            .expect('POST', '/api/contact', contactRequest)
            .respond(200);
          ContactAddController.add();
          $httpBackend.flush();
          expect(ContactAddController.success).toBe(
            'Done! We sent an email to your contact and he/she still needs to confirm it.',
          );
        });

        it('will make contact request with custom message', function () {
          const customMessage = 'my custom message';
          ContactAddController.contact.message = customMessage;
          $httpBackend
            .expect('POST', '/api/contact', {
              friendUserId: user2._id,
              message: customMessage,
            })
            .respond(200);
          ContactAddController.add();
          $httpBackend.flush();
          expect(ContactAddController.success).toBe(
            'Done! We sent an email to your contact and he/she still needs to confirm it.',
          );
        });

        describe('when unconfirmed contact conflict', function () {
          beforeEach(function () {
            $httpBackend
              .expect('POST', '/api/contact', contactRequest)
              .respond(409, { confirmed: false });
          });

          it('displays a confirmation waiting success message', function () {
            ContactAddController.add();
            $httpBackend.flush();
            expect(ContactAddController.success).toBe(
              'Connection already initiated; now it has to be confirmed.',
            );
          });
        });

        describe('with confirmed contact conflict', function () {
          beforeEach(function () {
            $httpBackend
              .expect('POST', '/api/contact', contactRequest)
              .respond(409, { confirmed: true });
          });

          it('displays an already connected success message', function () {
            ContactAddController.add();
            $httpBackend.flush();
            expect(ContactAddController.success).toBe(
              'You two are already connected. Great!',
            );
          });
        });
      });
    });
  });
});
