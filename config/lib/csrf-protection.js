const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const requestMarkerHeader = 'x-trustroots-request';
const requestMarkerValue = '1';
const exemptPaths = new Set([
  '/api/report-csp-violation',
  '/api/report-expect-ct-violation',
  '/api/sparkpost/webhook',
]);

function configuredOrigins(config) {
  const protocol = config.https ? 'https' : 'http';
  const origins = [new URL(`${protocol}://${config.domain}`).origin];

  for (const origin of config.csrfAllowedOrigins || []) {
    origins.push(new URL(origin).origin);
  }

  return new Set(origins);
}

function contentType(req) {
  return (req.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
}

function isJsonContentType(type) {
  return type === 'application/json' || type.endsWith('+json');
}

function hasRequestMarker(req) {
  return req.get(requestMarkerHeader) === requestMarkerValue;
}

module.exports = function csrfProtection(config) {
  const allowedOrigins = configuredOrigins(config);

  return function checkRequestOrigin(req, res, next) {
    if (!stateChangingMethods.has(req.method) || exemptPaths.has(req.path)) {
      return next();
    }

    const origin = req.get('origin');
    if (origin) {
      let parsedOrigin;
      try {
        parsedOrigin = new URL(origin).origin;
      } catch (error) {
        return res
          .status(403)
          .send({ message: 'Cross-origin request rejected' });
      }

      if (origin !== parsedOrigin || !allowedOrigins.has(parsedOrigin)) {
        return res
          .status(403)
          .send({ message: 'Cross-origin request rejected' });
      }
    }

    const fetchSite = req.get('sec-fetch-site');
    if (fetchSite && fetchSite.toLowerCase() !== 'same-origin') {
      return res.status(403).send({ message: 'Cross-origin request rejected' });
    }

    const type = contentType(req);
    const isMultipart = type === 'multipart/form-data';
    if (isMultipart && !hasRequestMarker(req)) {
      return res.status(403).send({ message: 'Request header required' });
    }

    const hasBrowserOriginSignal = Boolean(origin || fetchSite);
    if (!hasBrowserOriginSignal) {
      if (req.path === '/api/auth/signout' && !hasRequestMarker(req)) {
        return res.status(403).send({ message: 'Request header required' });
      }

      if (req.path.startsWith('/api/')) {
        if (!isJsonContentType(type) && !hasRequestMarker(req)) {
          return res.status(403).send({ message: 'Request header required' });
        }
      }
    }

    return next();
  };
};
