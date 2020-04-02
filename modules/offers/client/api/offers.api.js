import axios from 'axios';

export async function readByUserId(userId, types) {
  let data;
  try {
    ({ data } = await axios.get(`api/offers-by/${userId}?types=${types}`));
  } catch (e) {
    /*
     * @TODO i'd expect the api to look as follows:
     * GET /api/users/userId/offers?types=host
     * (the request url is arbitrary, so /api/offers-by/userId is fine, too)
     * and return 404 when user not found
     * but [] when user exists but has no host offers
     */
    if (e?.response?.status === 404) {
      data = [];
    } else {
      throw e;
    }
  }
  data.forEach(offer => {
    offer.location = formatLocation(offer.location);
  });
  return data;
}

function formatLocation(location) {
  if (Array.isArray(location) && location.length === 2) {
    const [lat, lng] = location;
    return { lat, lng };
  } else {
    return null;
  }
}

export async function create(data) {
  await axios.post('api/offers', data);
}

export async function update(offerId, data) {
  await axios.put(`api/offers/${offerId}`, data);
}
