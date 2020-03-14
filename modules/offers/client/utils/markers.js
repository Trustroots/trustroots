const metersPerPixel = ({ latitude, zoom }) => {
  const earthCircumference = 40075017;
  const latitudeRadians = latitude * (Math.PI / 180);
  return (
    (earthCircumference * Math.cos(latitudeRadians)) / Math.pow(2, zoom + 8)
  );
};

export const zoomToPixelMeters = ({ latitude, meters, zoom }) =>
  meters / metersPerPixel({ latitude, zoom });

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
