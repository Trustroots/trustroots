import offersData from './offers.json'
import offerData from './offer.json'
import  { Offer, OffersData } from './types'

/**
 * API request: read user's offers
 * @param {int} userId - id of user
 * @returns Promise<Offer[]> - array of the found offers
 */
export async function getOffers(_userId: string, _types: any ): Promise<OffersData> {
    return offersData
}

/**
 * API request: reade offer by id
 * @param {int} offerId - id of offer
 * @returns Promise<Offer> - a single offer
 */
export async function getOffer(_offerId: string): Promise<Offer> {
  return offerData;
}

/**
 * API request: query for offers by search arguments, namely bounding box location coordinates and other search filters
 * @param {int} offerId - id of offer
 * @returns Promise<Offer[]> - array of the found offers with limited info, mainly offer id and type.
 */
export async function queryOffers(_query = {}): Promise<OffersData> {
    return offersData
}
