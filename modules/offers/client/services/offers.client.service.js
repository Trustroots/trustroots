'use strict';

//Offers service used for communicating with the offers REST endpoints

// Read offers by userId
angular.module('offers').factory('OffersBy', ['$resource',
  function($resource) {
    return $resource('/api/offers-by/:userId', {
      userId: '@id'
    }, {
      update: {
        method: 'PUT'
      }
    });
  }
]);


// Read offer by offerId
angular.module('offers').factory('Offers', ['$resource',
  function($resource) {
    return $resource('/api/offers/:offerId', {
      offerId:'@id'
    }, {
      get: {
        method: 'GET'
      }
    });
  }
]);
