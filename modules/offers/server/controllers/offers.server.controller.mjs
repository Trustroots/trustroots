import service from './offers.server.controller.mts';

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
export { deleteOffer as delete };
export default service;
export { service as 'module.exports' };
