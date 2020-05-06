angular
  .module('users')
  .controller('ConfirmEmailController', ConfirmEmailController);

function getEmailFromToken(token) {
  // old tokens have lenght 40 symbols. pullrequest #465
  if (token.length <= 40) {
    return null;
  }
  let str = '';
  for (let i = 40; i < token.length; i += 2) {
    str += String.fromCharCode(parseInt(token.substr(i, 2), 16));
  }
  return str;
}

/* @ngInject */
function ConfirmEmailController(
  $rootScope,
  $http,
  $state,
  $stateParams,
  Authentication,
) {
  // ViewModel
  const vm = this;

  // Exposed to the view
  vm.confirmEmail = confirmEmail;
  vm.success = null;
  vm.error = null;
  vm.isLoading = false;
  vm.email = getEmailFromToken($stateParams.token);

  // Is ?signup at the url (set only for first email confirms)
  vm.signup = angular.isDefined($stateParams.signup);

  // Change user password
  function confirmEmail() {
    vm.isLoading = true;
    vm.success = vm.error = null;

    $http.post('/api/auth/confirm-email/' + $stateParams.token).then(
      function (response) {
        // On success function

        // Attach user profile
        Authentication.user = response.data.user;
        $rootScope.$broadcast('userUpdated');

        if (response.data.profileMadePublic) {
          // If successful and this was user's first confirm, welcome them to the community
          $state.go('welcome');
        } else {
          // If succesfull and wasn't first time, say yay!
          vm.success = true;
        }
      },
      function () {
        // On error function
        vm.error = true;
      },
    );
  }
}
