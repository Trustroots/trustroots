import type { DecodedResult } from 'nostr-tools/nip19';
import type { Application } from 'express';
import _ from 'lodash';
import core from './../controllers/core.server.controller.mjs';
import tribes from './../../../tribes/server/controllers/tribes.server.controller.mjs';
import authenticationService from './../../../users/server/services/authentication.server.service.mjs';
import * as nip19 from 'nostr-tools/nip19';
import mongoose from 'mongoose';
import { getMapDefaultLocation } from '../controllers/map-default-location.server.controller.mts';
import { listFeaturedNotes } from '../controllers/featured-nostr-notes.server.controller.mts';

/**
 * Module dependencies.
 */

type NostrUserRecord = {
  username: string;
  nostrNpub?: string;
  public?: boolean;
  email?: string;
  roles: string[];
};
const defaultExport = function (app: Application) {
  const redirect = function (src: string, dst: string) {
    app.route(src).get(function (req, res) {
      res.redirect(301, dst);
    });
  };
  app.route('/login').get(function (req, res) {
    const query = req.originalUrl.indexOf('?');
    res.redirect(
      302,
      '/signin' + (query === -1 ? '' : req.originalUrl.slice(query)),
    );
  });
  redirect('/invite', '/signup');
  redirect('/tribes/lgbt', '/circles/lgbtq');
  redirect('/tribes/vegans-vegetarians', '/circles/veg');

  // `/tribes/*` and `/faq/tribes` routes deprecated in August 2020
  // https://ideas.trustroots.org/2020/08/04/introducing-circles/
  redirect('/faq/tribes', '/faq/circles');
  redirect('/tribes', '/circles');
  app.route('/tribes/:tribe').get(function (req, res) {
    const tribe = _.get(req, ['tribe', 'slug']);
    const route = tribe ? '/circles/' + tribe : '/circles';
    res.redirect(301, route);
  });

  // Future push: expose service-worker config here if browser push returns
  // (previously GET /config/sw.js → core.renderServiceWorkerConfig).

  // CSP Violations
  // Note: If you’re using a CSRF module like csurf, you might have problems
  // handling these violations without a valid CSRF token. The fix is to put
  // your CSP report route above csurf middleware.
  // See `config/lib/express.js` and `initHelmetHeaders()` for more
  app.route('/api/report-csp-violation').post(core.receiveCSPViolationReport);
  app.route('/api/languages').get(core.getLanguages);
  app.route('/api/map-default-location').get(getMapDefaultLocation);
  app.route('/api/nostr/featured-notes').get(listFeaturedNotes);
  app.route('/api/nostr/author-visibility').get(function (req, res) {
    const profilesRequested = req.query.profiles === '1';
    const includeProfiles =
      profilesRequested &&
      Boolean((req as typeof req & { user?: unknown }).user);
    if (profilesRequested) res.set('Cache-Control', 'private, no-store');
    const User = mongoose.model<NostrUserRecord>('User');
    const rawPubkeys = req.query.pubkey;
    const pubkeys = Array.isArray(rawPubkeys) ? rawPubkeys : [rawPubkeys];
    if (
      // Stryker disable next-line ConditionalExpression,EqualityOperator: the qs query parser turns more than 20 repeated keys into an object, so no request reaches this with over 100 keys
      pubkeys.length > 100 ||
      pubkeys.some(
        pubkey => typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey),
      )
    ) {
      return res.status(400).send({
        error: 'One to 100 valid public keys required.',
      });
    }
    const normalizedPubkeys = [
      ...new Set(
        (pubkeys as string[]).map(pubkey => String(pubkey).toLowerCase()),
      ),
    ];
    // Stryker disable next-line ArrayDeclaration: an extra $in value only widens the fetch, and the response keeps only users whose npub encodes a requested key
    const npubs: string[] = [];
    for (const pubkey of normalizedPubkeys) {
      npubs.push(nip19.npubEncode(String(pubkey)));
    }
    // Stryker disable next-line ObjectLiteral: the response filters the found users by the requested keys again, so the query only narrows the fetch
    User.find({
      nostrNpub: {
        $in: npubs,
      },
    }).then(
      (users: NostrUserRecord[]) => {
        const linkedNpubs = new Set(users.map(user => user.nostrNpub));
        const visibleUsers = new Map(
          users
            .filter(
              user =>
                user.public &&
                user.email &&
                !user.roles.some(role =>
                  ['suspended', 'shadowban'].includes(role),
                ),
            )
            .map(user => [user.nostrNpub, user.username]),
        );
        const visiblePubkeys = normalizedPubkeys.filter(pubkey =>
          visibleUsers.has(nip19.npubEncode(pubkey)),
        );
        return res.json({
          linkedPubkeys: normalizedPubkeys.filter(pubkey =>
            linkedNpubs.has(nip19.npubEncode(pubkey)),
          ),
          pubkeys: visiblePubkeys,
          ...(includeProfiles && {
            usernames: Object.fromEntries(
              visiblePubkeys.map(pubkey => [
                pubkey,
                visibleUsers.get(nip19.npubEncode(pubkey)),
              ]),
            ),
          }),
        });
      },
      () =>
        res.status(500).send({
          error: 'Internal server error',
        }),
    );
  });

  // Return a 404 for all undefined api, module or lib routes
  app.route(/^\/(?:api|modules|lib|developers)\//i).get(core.renderNotFound);

  // Protect direct page loads before the client-side route guard is ready.
  // Signed-in members continue to the generic circle route below.
  app.route('/circles/naturists').get(function (req, res, next) {
    if (!(req as typeof req & { user?: unknown }).user) {
      return res.redirect('/signin');
    }
    return next();
  });

  // Define a tribes route to ensure we'll pass tribe object to index
  // Object is passed to layout at `core.renderIndex()`
  app.route('/circles/:tribe').get(core.renderIndex);
  app.route('/.well-known/nostr.json').get(function (req, res) {
    // NIP05 work in progress, https://github.com/Trustroots/trustroots/issues/2692
    const User = mongoose.model<NostrUserRecord>('User');
    res.set('Access-Control-Allow-Origin', '*');
    const rawName = req.query.name;
    if (!authenticationService.isLegacyUsernameLookupValid(rawName)) {
      return res.status(400).send({
        error: 'Valid username required.',
      });
    }
    const name = String(rawName).toLowerCase();
    User.findOne({
      username: name,
      public: true,
      email: {
        $exists: true,
        $nin: ['', null],
      },
      roles: {
        $nin: ['suspended', 'shadowban'],
      },
    }).then(
      (user: NostrUserRecord | null) => {
        const obj: { names: Record<string, string> } = {
          names: {},
        };
        if (!user) {
          res.json(obj);
          return;
        }
        const nostrNpub = user.nostrNpub;
        try {
          // Stryker disable next-line ConditionalExpression: decoding a missing key throws, and the catch below also leaves the names empty
          if (nostrNpub) {
            const decode: (code: string) => DecodedResult = nip19.decode;
            const result = decode(nostrNpub);
            if (result.type === 'npub' && /^[0-9a-f]{64}$/i.test(result.data)) {
              obj.names[name] = result.data.toLowerCase();
            }
          }
        } catch {
          // Malformed stored Nostr keys should fail closed.
        }
        res.json(obj);
      },
      () => {
        res.status(500).send({
          error: 'Internal server error',
        });
      },
    );
  });

  // Define application route
  app.route('/{*splat}').get(core.renderIndex);

  // Finish by binding the tribes middleware
  app.param('tribe', tribes.tribeBySlug);
};
export default defaultExport;
export { defaultExport as 'module.exports' };
