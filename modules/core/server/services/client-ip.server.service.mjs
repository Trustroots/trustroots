import net from 'net';

function getClientIpAddress(req) {
  // Passenger sets this secure header after Nginx restores the visitor address.
  // Do not trust ordinary forwarding headers supplied by clients.
  const passengerClientAddress = req.get('!~Passenger-Client-Address');
  const clientIpAddress = passengerClientAddress || req.ip;

  return net.isIP(clientIpAddress) ? clientIpAddress : undefined;
}

const defaultExport = { getClientIpAddress };
export default defaultExport;
export { getClientIpAddress };
export { defaultExport as 'module.exports' };
