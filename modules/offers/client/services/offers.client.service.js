// Offers service used for communicating with the offers REST endpoints
angular.module('offers').factory('OffersService', OffersService);

/* @ngInject */
function OffersService($resource) {
  const Offer = $resource(
    '/api/offers/:offerId',
    {
      offerId: '@_id',
    },
    {
      get: {
        method: 'GET',
        cancellable: true,
      },
      update: {
        method: 'PUT',
      },
      save: {
        method: 'POST',
      },
      delete: {
        method: 'DELETE',
      },
    },
  );

  angular.extend(Offer.prototype, {
    createOrUpdate() {
      const offer = this;
      return createOrUpdate(offer);
    },
  });

  return Offer;

  /**
   * Update if offer has `_id` and otherwise save it as new offer
   */
  function createOrUpdate(offer) {
    if (offer._id) {
      return offer.$update();
    } else {
      return offer.$save();
    }
  }
}
