(function () {
  'use strict';

  angular
    .module('users')
    .controller('InviteController', InviteController);

  /* @ngInject */
  function InviteController(InvitationService, Authentication, $window, $location, $timeout, $state, invitation) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.invitation = invitation;
    vm.signUpUrl = '';

    configureAddThis();

    /**
     * Configure add this share buttons
     * https://www.addthis.com/academy/category/developer-documentation/
     */
    function configureAddThis() {

      // Ensure we have code and continue only then
      vm.invitation.$promise.then(function(invitation) {

        var code = invitation.code.toUpperCase();

        // Build full domain dynamically
        var domain =
          $location.protocol() +
          '://' +
          $location.host() +
          ($location.port() === '80' || $location.port() === '443' ? '' : ':' + $location.port());

        // Build full signup URL dynamically (including domain and path)
        vm.signUpUrl = domain + '/c/' + code;
        // To get full URL without shortcode:
        // $state.href('signup', { code: code });

        var inviteTextPersonal =
          'Would you like to join me on Trustroots.org? ' +
          'It\'s an invitation only travellers community where we ' +
          'host and meet each other.';

        var inviteSingupUrlText =
          'You can sign up at ' + vm.signUpUrl +
          ' (link is valid for 24 hours)';

        var inviteTextGeneric =
          'You have been invited to join Trustroots, an invite only ' +
          'travellers community where people host and meet each other.' +
          inviteSingupUrlText;

        // UI Configuration
        // @link https://www.addthis.com/academy/addthis-email-sharing-service/
        // @link https://www.addthis.com/academy/the-addthis_config-variable/
        $window.addthis_config = {
          ui_email_from: Authentication.user.email,
          ui_email_note: inviteTextPersonal,
          data_track_clickback: false,
          data_track_addressbar: false
        };

        // Configure AddThis to send GA data
        // @link https://www.addthis.com/academy/integrating-with-google-analytics/
        if ($window.gaId) {
          $window.addthis_config.data_ga_property = $window.gaId;
        }

        // Sharing Configuration
        // https://www.addthis.com/academy/the-addthis_share-variable/
        $window.addthis_share = {
          url: vm.signUpUrl,
          title: Authentication.user.displayName + ' invites you to join Trustroots.org',
          description: inviteTextGeneric,
          // Image used for sharing
          // Image URL would be appended to "note" section in invite emails as well
          // media: domain + '/modules/core/img/og_image.jpg',
          email_template: 'invite',
          email_vars: {
            'code': code,
            'invitee': Authentication.user.displayName
          }
        };

      });
    }

  }

}());
