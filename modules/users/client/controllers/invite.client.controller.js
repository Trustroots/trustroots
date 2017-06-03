(function () {
  'use strict';

  angular
    .module('users')
    .controller('InviteController', InviteController);

  /* @ngInject */
  function InviteController(InvitationService, Authentication, $window, $location, $timeout, $state) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.invitation = InvitationService.get();

    configureAddThis();

    /**
     * Configure add this share buttons
     * https://www.addthis.com/academy/category/developer-documentation/
     */
    function configureAddThis() {

      // Ensure we have code and continue only then
      vm.invitation.$promise.then(function() {

        // Build full domain dynamically
        var domain =
          $location.protocol() +
          '://' +
          $location.host() +
          ($location.port() !== '80' ? ':' + $location.port() : '');

        // Build full signup URL dynamically (including domain and path)
        var signUpUrl = domain + $state.href('signup', { code: vm.invitation.code });

        $window.addthis_config = {
          ui_email_from: Authentication.user.email,
          ui_email_note:
            'Would you like to join me on Trustroots.org? ' +
            'It\'s an invitation only travellers community where travellers ' +
            'host and meet each other.'
        };

        // Configure AddThis to send GA data
        // @link https://www.addthis.com/academy/integrating-with-google-analytics/
        if ($window.gaId) {
          $window.addthis_config.data_ga_property = $window.gaId;
        }

        $window.addthis_share = {
          url: signUpUrl,
          title: Authentication.user.displayName + ' invites you to join Trustroots.org',
          description:
            'You have been invited to join Trustroots, an invite only community ' +
            'for travelers for hosting each other. ' +
            'Your invite code to join Trustroots is: ' + vm.invitation.code + ' ' +
            'You can sign up at ' + signUpUrl,
          media: domain + '/modules/core/img/og_image.jpg',
          email_template: 'invite',
          email_vars: {
            'code': vm.invitation.code,
            'invitee': Authentication.user.displayName
          },
          passthrough: { }
        };

      });
    }

  }

}());
