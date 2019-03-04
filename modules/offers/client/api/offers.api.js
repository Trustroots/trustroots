import axios from 'axios';

/**
 * API request: read user offer
 * @param {int} userId - id of user
 * @returns Promise<Offer[]> - array of the found offers
 */
export async function getOffers(userId){
  const { data: offers } = await axios.get(`/api/offers-by/${userId}`);
  return offers;
}
