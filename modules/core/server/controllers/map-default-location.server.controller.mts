import type { RequestHandler } from 'express';
import config from '../../../../config/config.mts';
import { getClientIpAddress } from '../services/client-ip.server.service.mts';
import { createGeoipLookup } from '../services/geoip.server.service.mts';

const lookup = createGeoipLookup(config.geoip.databasePath);

export const getMapDefaultLocation: RequestHandler = async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!(req as typeof req & { user?: unknown }).user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }
  const location = await lookup(getClientIpAddress(req));
  res.json({ location });
};
