/**
 * Return HEX color for the type of hosting offer
 *
 * @param  {String} [offerType='other']
 * @param  {String} [offerStatus='yes']
 * @return {string} HEX value
 */
export const getOfferHexColor = ({
  offerType = 'other',
  offerStatus = 'yes',
}) => {
  if (offerType === 'host' && offerStatus === 'yes') {
    return '#5cb85c'; // hosting, yes
  }

  if (offerType === 'host' && offerStatus === 'maybe') {
    return '#f0ad4e'; // hosting, maybe
  }

  if (offerType === 'host' && offerStatus === 'no') {
    return '#d9534f'; // hosting, no
  }

  if (offerType === 'meet') {
    return '#0081a1'; // meet
  }

  return '#000';
};
