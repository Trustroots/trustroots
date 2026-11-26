import type { DecodedResult } from 'nostr-tools/nip19';
import type { Application } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import core from './../controllers/core.server.controller.mts';
import authenticationService from './../../../users/server/services/authentication.server.service.mts';
import * as nip19 from 'nostr-tools/nip19';
import mongoose from 'mongoose';
import { getMapDefaultLocation } from '../controllers/map-default-location.server.controller.mts';
import { listFeaturedNotes } from '../controllers/featured-nostr-notes.server.controller.mts';
import { publicNip05MemberFilter } from '../services/nostr-identity.server.service.mts';
import { getClientIpAddress } from '../services/client-ip.server.service.mts';
import {
  getNostrServiceSigner,
  trustrootsNostrServiceName,
} from '../services/nostr-service-signer.server.mts';

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

function createNostrLookupLimit() {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Stryker disable next-line StringLiteral: the fallback label does not change the shared bucket's quota
    keyGenerator: req => ipKeyGenerator(getClientIpAddress(req) ?? 'unknown'),
    message: { error: 'Too many Nostr lookups. Please try again shortly.' },
  });
}

export default function (app: Application) {
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
    const tribe = (req as typeof req & { tribe?: { slug?: string } }).tribe
      ?.slug;
    const route = tribe ? '/circles/' + tribe : '/circles';
    res.redirect(301, route);
  });

  // Future push: expose service-worker config here if browser push returns
  // (previously GET /config/sw.js → core.renderServiceWorkerConfig).

  // CSP Violations
  // Note: If you’re using a CSRF module like csurf, you might have problems
  // handling these violations without a valid CSRF token. The fix is to put
  // your CSP report route above csurf middleware.
  // See `config/lib/security-headers.mts` and `initSecurityHeaders()` for more
  app.route('/api/report-csp-violation').post(core.receiveCSPViolationReport);
  app.route('/api/languages').get(core.getLanguages);
  app.route('/api/map-default-location').get(getMapDefaultLocation);
  app.route('/api/nostr/featured-notes').get(listFeaturedNotes);
  const authorVisibility = app.route('/api/nostr/author-visibility');
  authorVisibility.get((req, res, next) => {
    if (req.query.profiles === '1')
      res.set('Cache-Control', 'private, no-store');
    next();
  }, createNostrLookupLimit());
  authorVisibility.get(function (req, res) {
    const includeProfiles =
      req.query.profiles === '1' &&
      Boolean((req as typeof req & { user?: unknown }).user);
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

  // The Tribes routes register the app-wide parameter lookup used by the
  // circle page head and the legacy redirect.
  app.route('/circles/:tribe').get(core.renderIndex);
  const nip05 = app.route('/.well-known/nostr.json');
  nip05.get((_req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    next();
  }, createNostrLookupLimit());
  nip05.get(function (req, res) {
    // NIP05 work in progress, https://github.com/Trustroots/trustroots/issues/2692
    const rawName = req.query.name;
    if (rawName === trustrootsNostrServiceName) {
      const signer = getNostrServiceSigner();
      return res.json({
        names: signer ? { [trustrootsNostrServiceName]: signer.publicKey } : {},
      });
    }
    if (!authenticationService.isLegacyUsernameLookupValid(rawName)) {
      return res.status(400).send({
        error: 'Valid username required.',
      });
    }
    const User = mongoose.model<NostrUserRecord>('User');
    const name = String(rawName).toLowerCase();
    User.findOne({
      ...publicNip05MemberFilter,
      username: name,
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
}
