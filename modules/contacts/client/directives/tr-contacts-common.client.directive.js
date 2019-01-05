// (function () {
//   'use strict';

//   /**
//    * List contacts in common
//    */
//   angular
//     .module('contacts')
//     .directive('trCommonContacts', trContactsCommonDirective);

//   /* @ngInject */
//   function trContactsCommonDirective(ContactsCommonListService) {
//     return {
//       templateUrl: '/modules/contacts/views/directives/tr-contacts-common.client.view.html',
//       restrict: 'A',
//       replace: true,
//       scope: {
//         profileId: '=trCommonContacts'
//       },
//       controller: trContactsCommonController,
//       controllerAs: 'contactsCommon'
//     };

//     function trContactsCommonController($scope) {

//       // ViewModel
//       var vm = this;

//       if (!$scope.profileId) {
//         return;
//       }

//       // Get an array of common contacts between
//       // profileId and currently authenticated user
//       vm.list = ContactsCommonListService.query({
//         listUserId: $scope.profileId
//       });

//     }
//   }

// }());
