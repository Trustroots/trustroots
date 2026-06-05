# Decentralized Hospitality Platform — Design Specification

**Date:** 2026-06-05
**Status:** Draft
**Scope:** Full platform rebuild — Nostr-native, privacy-first, decentralized hospitality exchange
**Repository:** New, standalone repository and directory (e.g., `../new-trustroots`). This is a greenfield project — not a fork, refactor, or extension of the existing Trustroots codebase. No code, dependencies, or structure is carried over.

---

## Table of Contents

1. [Principles & Philosophy](#1-principles--philosophy)
2. [Architecture Overview](#2-architecture-overview)
3. [Project Structure](#3-project-structure)
4. [Identity & Authentication](#4-identity--authentication)
5. [Cross-Platform Verification & Connectors](#5-cross-platform-verification--connectors)
6. [Privacy & Encrypted Offers](#6-privacy--encrypted-offers)
7. [Nostr Event Schema](#7-nostr-event-schema)
8. [Web of Trust Engine](#8-web-of-trust-engine)
9. [Search & Map](#9-search--map)
10. [Messaging](#10-messaging)
11. [Design System & Brand](#11-design-system--brand)
12. [Testing Strategy](#12-testing-strategy)
13. [CI/CD Pipeline](#13-cicd-pipeline)
14. [Development Process & Workflow](#14-development-process--workflow)
15. [NIP Research Protocol](#15-nip-research-protocol)
16. [Sub-Project Decomposition](#16-sub-project-decomposition)

---

## 1. Principles & Philosophy

These principles constrain every technical and design decision in the project. They are non-negotiable.

1. **Uncensorable by design** — No single entity can remove a user or their data. All user data lives on Nostr relays. No kill switch exists. No government or organization can deplatform a user.
2. **Unmonetizable by design** — No platform-level fees, ads, or data harvesting are structurally possible. The protocol is the product, not the platform. The architecture makes monetization impossible, not just policy.
3. **Strong privacy by default** — Hosting offers are encrypted. Users opt-in to visibility by configuring their WoT decryption radius. No public-by-default location data. Users can be fully anonymous until they choose otherwise.
4. **FOSS always** — All code, all relays, all tooling. AGPL-3.0 license to ensure forks remain open and share modifications.
5. **User sovereignty** — Your Nostr keypair is your identity. No email/password accounts. You own your data and can take it to any compatible client.
6. **Decentralized infrastructure** — Helper relays are commodity infrastructure, not control points. Anyone can run one. The network functions with any combination of relays.
7. **Interoperability** — Legacy hospitality networks are bridged via connectors, not replaced. Users shouldn't have to abandon existing communities. Bridging respects user privacy and platform terms.
8. **By the users, for the users, with the users** — Governance, development, and direction are community-driven. Open source from day one, forks welcome and encouraged.

### Bridge Ethics

Connectors to legacy networks (Trustroots, BeWelcome, Couchers, Couchsurfing) must be ethically and legally clean:

- **No scraping private data** — only access data that users have explicitly made public on the source platform.
- **User-initiated** — a user bridges their own profile/references by authenticating with their own credentials. We never bulk-scrape other users' data.
- **No ToS violation by design** — the connector acts as the user's own client, making requests on their behalf with their auth. Same as a mobile app or browser extension.
- **No data republication** — connector data is normalized and cached locally, never published to Nostr relays.
- **Attribution** — bridged data clearly indicates its origin (e.g., "via Trustroots").

---

## 2. Architecture Overview

```
+---------------------------------------------------+
|                     Clients                        |
|  +----------------+       +--------------------+  |
|  |  Web App        |       |  Mobile App         | |
|  |  TanStack Start |       |  React Native       | |
|  +--------+-------+       +----------+---------+  |
|           +----------+----------+                  |
|                 +----+-----+                       |
|                 |Shared Core|                      |
|                 |  modules  |                      |
|                 |  packages |                      |
|                 +----+-----+                       |
+----------------------+-----------+-----------------+
                       |           |
          +------------+           +----------+
          v                                   v
   +------------+                    +---------------+
   | Nostr       |                    | Bridge         |
   | Relays      |                    | (client-side)  |
   | (general +  |                    | Trustroots API |
   |  helper)    |                    +---------------+
   +------------+
```

### Four layers

1. **Shared Core** — TypeScript packages and modules. Nostr protocol handling, WoT engine, crypto (offer encryption/decryption), connector adapters, data models, API layer. Used by both web and mobile. No UI code in shared packages.

2. **Web App** (`apps/web`) — TanStack Start. SSR-capable, map-first UI. Consumes shared core.

3. **Mobile App** (`apps/native`) — React Native. Same features, native UX. Consumes shared core.

4. **Relay Infrastructure** (`apps/relay`) — Open-source, self-hostable hospitality helper relay. Indexes hospitality events, caches WoT graphs for performance queries. Not a gatekeeper — a convenience layer. The system works without it, just slower.

### No traditional backend

There is no backend server that holds user accounts or mediates access. Clients communicate directly with:

- **Nostr relays** — for publishing and reading events
- **Legacy network APIs** — via connectors running client-side, using the user's own credentials

---

## 3. Project Structure

**Monorepo: pnpm workspaces + Turborepo**

```
apps/
  web/                # TanStack Start web application
  native/             # React Native mobile application
  relay/              # Hospitality helper relay

modules/
  api/                # oRPC — shared API definitions

packages/
  ui/                 # Tailwind + shadcn/ui design system
  nostr/              # Nostr wrapper + WoT engine + crypto
                      #   Exports for React + React Native
  connectors/         # Bridge adapters (trustroots/, bewelcome/, etc.)
  env/                # t3-oss env helper, common presets
                      #   Each package has its own env.ts

tooling/
  tsconfig/           # Shared TypeScript configurations
  eslint/             # Shared ESLint configuration

docs/
  specs/              # Design specifications
  decisions/          # Architecture Decision Records (ADRs)

USER_STORIES.md       # Living feature checklist (repo root)
```

### Dependency hierarchy

Dependencies flow downward. No circular dependencies.

```
apps/* (web, native, relay)
  -> modules/api
  -> packages/*

modules/api
  -> packages/nostr
  -> packages/connectors
  -> packages/env

packages/connectors
  -> packages/nostr
  -> packages/env

packages/nostr
  -> packages/env

packages/ui
  -> packages/env (if needed)

packages/env
  -> (no internal dependencies)

tooling/*
  -> (no internal dependencies)
```

### Code conventions

- TypeScript strict mode everywhere
- No `any` types
- Direct imports only — no barrel exports (no `index.ts` re-exporting)
- No default exports (better refactoring, better grep-ability)
- Conventional commits (`feat:`, `fix:`, `chore:`)
- Types live in their respective packages, exported directly — no shared types package

---

## 4. Identity & Authentication

**No accounts. Your keypair is your identity.**

### Login methods

- **NIP-07** — browser signer extension (e.g., nos2x, Alby) on web
- **NIP-46 (Nostr Connect)** — remote signer support for multi-device and users who don't want to paste private keys
- **nsec direct entry** — fallback, with clear warnings about security implications
- **Amber / native signers** — on mobile

### New user flow

1. Generate a Nostr keypair
2. Back up seed phrase / nsec
3. Set profile metadata (kind 0): display name, avatar, bio, languages
4. Optionally set a NIP-05 identifier for discoverability
5. Add people you know IRL to bootstrap your WoT

### Key management

- Private key never leaves the client or signer
- `packages/nostr` handles all signing — UI layers never touch keys directly
- Seed phrase / backup flow is part of onboarding to prevent lockout
- Multi-device via NIP-46 remote signing

### No email, no password, no username registration

The app may optionally let users set a NIP-05 identifier (e.g., `alice@projectdomain.org`) for discoverability, but this is vanity — not identity.

---

## 5. Cross-Platform Verification & Connectors

### Bidirectional proof (identity verification)

To verify that a Nostr user is the same person as a user on a legacy network:

1. User adds their Nostr npub to their legacy platform profile (bio, website, description — any publicly visible field)
2. User tells our app their username on that platform
3. Connector fetches the platform profile, extracts the npub from whatever field the user placed it in
4. Confirms the npub matches the user's actual Nostr pubkey
5. Bidirectional link established — connector can now fetch on their behalf

This is trustless and independently verifiable by any client. No trusted third party needed.

### Connector behavior

- **Connectors fetch, never import to relays** — legacy network data stays on the legacy network
- **Data is normalized into our event kind schema** — same types as native Nostr events
- **Cached locally** with a sensible TTL — treated identically to relay-fetched events in the UI and WoT engine
- **Displayed alongside native data** — same visual treatment, clearly marked with origin
- **User authenticates with their own credentials** — the connector acts as their personal client

### Connector architecture (`packages/connectors`)

```
connectors/
  src/
    interface.ts            # Common connector interface
    trustroots/
      client.ts             # Trustroots API client (reverse-engineered)
      normalizer.ts         # Trustroots data -> our event types
      verifier.ts           # Bidirectional proof verification
    bewelcome/              # Future
    couchers/               # Future
```

Each connector implements the same interface: fetch profile, fetch references, fetch offers, verify identity link. Adding a new network = implementing the interface.

### Trustroots API research

The Trustroots API must be reverse-engineered before implementation. This is a dedicated research phase:

- Sniff requests the web app makes
- Document endpoints, auth flow, session management
- Map rate limits and data shapes
- Document which profile fields are publicly accessible (for npub extraction)

### Scope

Start with Trustroots only. The connector interface is designed so BeWelcome, Couchers, and Couchsurfing can be added later by implementing the same interface.

---

## 6. Privacy & Encrypted Offers

### Core concept

Hosting offers are encrypted by default. Only users within the host's configured Web of Trust radius can decrypt and view them. This is the platform's key differentiator.

### How it works

1. **User creates a hosting offer** — location, description, availability, house rules, etc.
2. **User configures their trust radius** — e.g., "direct contacts only," "friends of friends," "3 degrees out," or custom rules like "positively reviewed by someone I've hosted."
3. **The offer is encrypted and published to Nostr relays** as an encrypted event.
4. **A public beacon is also published** — approximate location (city-level) with configurable anonymity. Can range from fully anonymous ("someone hosts here") to partially revealing (aggregate reputation score, languages, hosting type).
5. **Only users within the configured trust radius can decrypt the full offer.**

### Key distribution via WoT chain (P2P)

No relay trust required. Keys are distributed peer-to-peer:

1. Host shares the offer decryption key with 1st-degree contacts via NIP-44 encrypted messages.
2. When a 2nd-degree user discovers a beacon and wants access, their client sends a key request to the mutual contact.
3. The mutual contact's client (automatically, based on the host's configured policy) derives a scoped key and forwards it.
4. This cascades up to the host's configured depth.

**On-demand fallback:** If no WoT path exists, a user can send a key request directly to the host. The host's client evaluates and responds (or ignores).

**Offline intermediaries:** Pre-distributed keys cover depth 1 (host shares directly with contacts). For depth 2+, an intermediary's client must be online (or have recently been online) to forward keys. If no intermediary is reachable, the user falls back to a direct key request to the host. This is an acceptable constraint — if nobody in your WoT is reachable, discovery is naturally limited.

### Properties

- **No relay trust required** — relays store encrypted blobs, nothing more.
- **Host controls the policy** — 1st-degree contacts enforce it by choosing whether to forward keys.
- **Revocation** — publish a new offer with a new key, re-share with current WoT.
- **Offline support** — keys can be pre-distributed, so contacts can decrypt without the host being online.
- **Scales naturally** — key forwarding is O(1) per hop, not O(n) per offer.

### Aggregate reputation on beacons

- Beacons can optionally include an aggregate reputation score/count (e.g., "12 verified stays, 100% positive")
- This is configurable — users choose how much to reveal on their beacon
- Verifiable: anyone who gains WoT access and decrypts the actual references can confirm the numbers check out
- Beacons with no reputation info are valid — fully anonymous hosting is supported

### Threat model

- Browsing the map reveals nothing about the browser to other users
- Exact search area is not broadcast
- Beacon locations are intentionally fuzzy (city-level geohash)
- WoT configuration (trust policy) is private — not published publicly
- References are encrypted — travel history and social graph are not exposed
- Stay confirmations are encrypted — proof of meeting is private

### Open design challenge

The WoT-gated encryption with configurable depth and P2P key distribution is genuinely novel cryptography. This requires:

- Dedicated crypto design as a sub-project
- Formal threat modeling
- Property-based testing for security invariants
- Potential academic review before production use

---

## 7. Nostr Event Schema

Custom event kinds for the hospitality protocol. Exact kind numbers TBD pending NIP registry research (see Section 15).

| Kind  | Purpose              | Visibility                             | Replaceable?                    |
| ----- | -------------------- | -------------------------------------- | ------------------------------- |
| 3x001 | Hosting beacon       | Public (configurable anonymity)        | Yes (one per user)              |
| 3x002 | Hosting offer (full) | WoT-encrypted                          | Parameterized (multiple offers) |
| 3x003 | Reference/review     | WoT-encrypted (both parties' policies) | No                              |
| 3x004 | Key grant            | NIP-44 encrypted P2P                   | No                              |
| 3x005 | Key request          | NIP-44 encrypted P2P                   | No                              |
| 3x006 | Trust policy         | Encrypted (private)                    | Yes (one per user)              |
| 3x007 | Stay confirmation    | WoT-encrypted (both sign)              | No                              |
| 3x008 | Introduction request | NIP-44 encrypted P2P                   | No                              |

### Design decisions

- **References are WoT-encrypted** — not public. Both the reviewer and the reviewed can configure visibility independently. A reference is only visible if both parties' WoT policies allow it. This prevents social graph and travel history exposure.
- **Stay confirmations are mutual** — both host and guest sign to confirm a stay happened. Prevents fake reviews from people who never met.
- **Trust policy is private** — your WoT radius configuration reveals information about your security posture and should not be public.
- **Beacons are replaceable** — one per user, updated in place.
- **Offers are parameterized replaceable** — allows multiple offers (e.g., different locations).

### Tags

Standard Nostr tag conventions:

- `g` — geohash for location-based filtering
- `d` — identifier for parameterized replaceable events
- `p` — pubkey references
- Custom tags for hospitality-specific metadata (hosting type, availability, languages, capacity)

---

## 8. Web of Trust Engine

The WoT engine lives in `packages/nostr` and is the core of the platform's trust and privacy model.

### Responsibilities

- **Graph construction** — build and maintain the user's trust graph from signed events (references, stay confirmations, contacts)
- **Distance calculation** — compute trust distance between any two pubkeys
- **Policy evaluation** — given a user's trust policy, determine if a requesting pubkey qualifies for decryption
- **Key derivation** — derive scoped decryption keys for different WoT depths
- **Key distribution** — handle key grant/request protocol
- **Connector integration** — incorporate verified connector data (e.g., Trustroots references) into WoT calculations as if they were native events

### Trust signals

- Direct contacts (explicitly added)
- Positive references (from decrypted review events)
- Stay confirmations (mutual proof of meeting)
- Bridged references (via verified connectors, weighted same as native)

### Configurable rules (examples)

- "Friends only" (depth 1)
- "Friends of friends" (depth 2)
- "Anyone positively reviewed by someone I've hosted" (custom rule)
- "3 degrees out with at least 2 independent paths" (redundancy requirement)

### Performance

- WoT graph can be large. Helper relays cache graph state for faster queries.
- Client-side: progressive loading — start with depth 1, expand as needed.
- Local caching of computed trust distances with invalidation on graph changes.

---

## 9. Search & Map

Map-based discovery is the primary UI for finding hosts.

### What appears on the map

- **Beacons** — dots/clusters at approximate locations. Anonymity level determines what's shown (could be just "someone hosts here" or include languages, hosting type, aggregate reputation).
- **WoT hosts** — beacons from users you can decrypt are visually distinguished (different color/icon).
- **Connector results** — legacy network hosts shown alongside native hosts, same visual treatment, marked with origin.

### Interaction flow

1. Browse map — see beacons in a region
2. Tap a beacon — see whatever the user's anonymity config allows
3. If in your WoT — offer is already decryptable, see full details
4. If not — option to send an introduction request through a mutual contact, or a direct key request to the host
5. Once access is granted — see full offer, references, message the host

### Technical approach

- **MapLibre GL** — open-source map rendering (no Mapbox dependency, aligns with FOSS principles)
- **Geohash-based clustering** of beacons
- **Location precision levels** — beacons use low-precision geohash (city-level), decrypted offers reveal higher precision
- **Tile server** — self-hostable option needed for full decentralization (e.g., OpenMapTiles)

### Privacy guarantees

- Browsing the map reveals nothing about you to other users
- Your exact search area is not broadcast to relays
- Beacon locations are intentionally fuzzy

---

## 10. Messaging

Direct messaging via existing Nostr standards. No custom messaging system.

### Implementation

- **NIP-44 encrypted DMs** — the current Nostr standard for private direct messages
- **Interoperable** — any Nostr client can read/send these messages
- **Conversation context** — messages can reference hosting offer events via tags

### Hospitality-specific conventions

Structured message types layered on top of NIP-44 (tagged DMs that our app interprets with richer UI, but degrade to normal DMs in other clients):

- **Stay request** — "I'd like to stay with you [dates], [message]"
- **Accept/decline** — structured responses to stay requests
- **Introduction** — forwarding a contact to bridge WoT gaps

### Connector messages

- Messages to/from legacy network users go through the connector using the user's own credentials
- Displayed in the same conversation UI, clearly marked as "via Trustroots" (or other source)

---

## 11. Design System & Brand

### Design system (`packages/ui`)

- **Foundation:** Tailwind CSS + shadcn/ui
- **Custom theme layer** — brand colors, typography, spacing, radius tokens
- **Cross-platform:** shared between web and mobile (NativeWind or similar for React Native)
- **Documented with Storybook**

### Brand principles

- **Warm but trustworthy** — hospitality is personal. The design should feel inviting, not corporate.
- **Privacy-forward** — privacy controls should feel empowering, not scary.
- **Minimal and clear** — map-first, content-second. No clutter.
- **Accessible** — WCAG 2.1 AA minimum.

### Marketing & landing page

- Part of the web app (TanStack Start serves both marketing and app routes)
- Clear value proposition communicating the WoT model simply and visually
- Explains the differentiator: privacy-first, decentralized, no platform lock-in

### Brand identity

- Name, logo, and color palette to be decided as a dedicated task before implementation
- Name should communicate: trust, openness, travel, community
- Should not reference underlying technology (not "Nostr-something")

---

## 12. Testing Strategy

Four layers, targeting impenetrable coverage.

### 1. Unit tests

- Every function in `packages/*` and `modules/*`
- Pure logic, crypto, normalizers, WoT calculations
- Fast, no network
- **Framework:** Vitest

### 2. Integration tests

- Connector API interactions
- Nostr relay communication
- Event encryption/decryption round-trips
- WoT key distribution chains
- Mock relays and mock Trustroots API for deterministic testing
- Real relay integration tests as a separate CI step

### 3. E2E tests

Full user flows:

- Generate keypair -> create offer -> friend decrypts -> send stay request -> confirm stay -> leave reference
- Connector: verify Trustroots link -> fetch profile -> view bridged references
- **Web:** Playwright
- **Mobile:** Detox (React Native)

### 4. Crypto-specific tests

The WoT encryption model gets its own test suite with property-based testing (fast-check):

- "A user at depth N+1 cannot decrypt an offer configured for depth N"
- "Revoked keys cannot decrypt re-encrypted offers"
- "Key derivation is deterministic given the same inputs"
- "Mutual reference visibility requires both parties' policies to allow it"

### Coverage

- Enforced in CI — PR fails if coverage drops
- Targeting 90%+ for `packages/nostr` and `packages/connectors`
- 80% minimum floor for all other packages — no exceptions

---

## 13. CI/CD Pipeline

GitHub Actions with Turborepo caching.

```
On every PR:
  +-- Lint (ESLint + Prettier check)
  +-- Type check (tsc --noEmit across all packages)
  +-- Unit tests (all packages, parallel via Turborepo)
  +-- Integration tests
  +-- E2E tests (web / Playwright)
  +-- Build check (all apps compile)
  +-- Circular dependency check

On merge to main:
  +-- Full test suite including mobile E2E (Detox)
  +-- Build artifacts
  +-- Deploy preview
```

Turborepo remote cache ensures unchanged packages skip tests and builds.

---

## 14. Development Process & Workflow

### Branching model

- `main` is always deployable
- Feature branches off `main`, merged via PR
- No long-lived development branches
- Squash merges to keep history clean

### PR requirements

- All CI checks pass
- User stories checklist updated if applicable
- Conventional commits (`feat:`, `fix:`, `chore:`)

### Monorepo workflow

- `pnpm dev` starts everything (web, mobile, relay) with hot reload
- Package dependency graph enforced — CI fails on circular dependencies
- Each package has its own `env.ts` via `packages/env` presets
- No barrel exports — direct imports only
- No default exports

### Documentation

- `USER_STORIES.md` in repo root — living feature checklist with two sections: "Trustroots parity" and "New capabilities." Checked off as implemented.
- ADRs in `docs/decisions/` for significant technical choices
- Package-level READMEs for contributor onboarding
- Design specs in `docs/specs/`

### Open source

- AGPL-3.0 license from day one
- CONTRIBUTING.md with setup instructions
- Issues and discussions on GitHub
- Forks welcome and encouraged

---

## 15. NIP Research Protocol

Before finalizing any event kind numbers or protocol decisions:

1. **Scan the [nostr-protocol/nips](https://github.com/nostr-protocol/nips) repository** for current NIP definitions
2. **Check open PRs and discussions** for proposed/draft NIPs that overlap with our needs (hospitality, WoT, encrypted groups, location-based events, access control)
3. **Prefer adopting existing or in-progress NIPs** over inventing custom kinds where possible
4. **If custom kinds are needed**, check the NIP registry for available ranges
5. **Consider proposing our own NIP** for the hospitality protocol once the design is validated

This is a dedicated research task that must be completed before event schema implementation.

---

## 16. Sub-Project Decomposition

This project is too large for a single implementation plan. It decomposes into these sub-projects, each getting its own spec -> plan -> implementation cycle:

### Phase 1: Foundation

1. **Monorepo setup** — pnpm + Turborepo, all packages scaffolded, CI/CD pipeline, tooling
2. **`packages/nostr` core** — Nostr client wrapper, event types, basic signing/verification
3. **`packages/env`** — environment configuration setup

### Phase 2: Identity & Crypto

4. **Identity & auth** — keypair generation, NIP-07/NIP-46 signer integration, profile management (kind 0)
5. **WoT engine** — trust graph construction, distance calculation, policy evaluation
6. **Encrypted offers crypto** — key derivation, WoT-gated encryption/decryption, key grant/request protocol

### Phase 3: Core Features

7. **Hosting offers & beacons** — create/edit/publish offers, configurable beacon anonymity
8. **Search & map** — MapLibre integration, beacon display, geohash clustering, WoT-filtered results
9. **Messaging** — NIP-44 DMs, stay requests, accept/decline flow
10. **References & stay confirmations** — mutual signing, encrypted reviews, WoT-scoped visibility

### Phase 4: Connectors & Interop

11. **Trustroots API research** — reverse-engineer endpoints, document auth flow and data shapes
12. **Trustroots connector** — bidirectional verification, profile/reference fetching, normalization
13. **Connector integration** — display bridged data in UI, incorporate in WoT calculations

### Phase 5: Apps & Polish

14. **Web app** — TanStack Start, full feature set, marketing/landing page
15. **Mobile app** — React Native, full feature set, native signer integration
16. **Design system & brand** — name, identity, component library, Storybook
17. **Helper relay** — hospitality event indexing, WoT graph caching

### Phase 6: Hardening

18. **Security audit** — crypto review, threat modeling, penetration testing
19. **Performance optimization** — WoT computation, map rendering, relay queries
20. **User stories verification** — full checklist pass against Trustroots feature parity + new capabilities

Each sub-project is independently plannable and implementable. Dependencies flow top-to-bottom (Phase 1 before Phase 2, etc.), but sub-projects within a phase can often be parallelized.
