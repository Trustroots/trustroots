import service from './offers.server.controller.mts';

/** @esmNamed */
export const {
  create,
  delete: deleteOffer,
  getOffer,
  list,
  listOffersByUser,
  offerById,
  offersByUserId,
  removeAllByUserId,
  update,
} = service;
/** @esmNamed */
export { deleteOffer as delete };
export default service;
/** @commonjs */
export { service as 'module.exports' };
