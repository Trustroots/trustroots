import net from 'net';

interface ClientIpRequest {
  get(header: string): string | undefined;
  ip?: string;
}

export function getClientIpAddress(req: ClientIpRequest): string | undefined {
  // Passenger sets this secure header after Nginx restores the visitor address.
  // Do not trust ordinary forwarding headers supplied by clients.
  const passengerClientAddress = req.get('!~Passenger-Client-Address');
  const clientIpAddress = passengerClientAddress || req.ip;

  return net.isIP(clientIpAddress ?? '') ? clientIpAddress : undefined;
}

const defaultExport = { getClientIpAddress };
export default defaultExport;
export { defaultExport as 'module.exports' };
