import passkeys from '../services/passkey.server.service.mjs';
import profile from './users.profile.server.controller.mjs';

export function handler(operation, login = false) {
  return async function passkeyRequest(req, res) {
    res.set('Cache-Control', 'no-store');
    res.vary('Cookie');
    try {
      const result = await passkeys[operation](req);
      if (login) {
        return req.login(result, error => {
          if (error)
            return res
              .status(503)
              .json({ message: 'Could not complete sign-in.' });
          return res.json(profile.sanitizeOwnProfile(result));
        });
      }
      return res.json(result);
    } catch (error) {
      const status = error.status || 400;
      return res.status(status).json({
        message: error.status
          ? error.message
          : 'Passkey request was not accepted. Try again.',
      });
    }
  };
}

export default {
  list: handler('list'),
  registrationOptions: handler('registrationOptions'),
  register: handler('register'),
  authenticationOptions: handler('authenticationOptions'),
  authenticate: handler('authenticate', true),
  remove: handler('remove'),
};
