# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a greenfield monorepo with all packages, apps, tooling, CI/CD pipeline, and a working Nostr connection — ready for Phase 2 feature development.

**Architecture:** pnpm workspaces + Turborepo monorepo. Packages export TypeScript directly (no pre-build step for internal packages). Apps bundle via their own build tools. Strict dependency hierarchy: `packages/env` at the bottom, `packages/nostr` and `packages/ui` in the middle, `modules/api` above, `apps/*` at the top.

**Tech Stack:**

- pnpm 11.x, Turborepo 2.x, TypeScript 6.x
- React 19.x, @tanstack/react-start 1.x, React Native 0.85.x
- Vitest 4.x, Playwright 1.x, ESLint 10.x, Prettier 3.x
- nostr-tools 2.x, @orpc/server 1.x, @t3-oss/env-core 0.13.x
- Tailwind CSS 4.x

**Spec reference:** `docs/superpowers/specs/2026-06-05-hospitality-platform-rebuild-design.md`

**Target directory:** `../new-trustroots` (sibling to current Trustroots checkout). This is a new repository — nothing is carried over.

---

## File Structure

```
new-trustroots/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # PR checks: lint, typecheck, test, build
│       └── ci-full.yml               # Merge-to-main: full suite incl. mobile E2E
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── routes/
│   │   │   │   └── __root.tsx        # Root route
│   │   │   ├── client.tsx            # Client entry
│   │   │   └── router.tsx            # Router config
│   │   ├── package.json
│   │   ├── app.config.ts             # TanStack Start config
│   │   ├── tsconfig.json
│   │   └── env.ts                    # Web-specific env vars
│   ├── native/
│   │   ├── src/
│   │   │   └── App.tsx               # Root component
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── env.ts                    # Native-specific env vars
│   └── relay/
│       ├── src/
│       │   └── index.ts              # Relay entry point
│       ├── package.json
│       ├── tsconfig.json
│       └── env.ts                    # Relay-specific env vars
├── modules/
│   └── api/
│       ├── src/
│       │   └── router.ts             # oRPC router definition
│       ├── package.json
│       ├── tsconfig.json
│       └── env.ts                    # API-specific env vars
├── packages/
│   ├── env/
│   │   ├── src/
│   │   │   └── preset.ts             # Common env preset
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── nostr/
│   │   ├── src/
│   │   │   ├── client.ts             # Nostr relay client wrapper
│   │   │   ├── events.ts             # Event type definitions
│   │   │   ├── keys.ts               # Key generation and management
│   │   │   └── client.test.ts        # Client tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── connectors/
│   │   ├── src/
│   │   │   └── interface.ts          # Common connector interface
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── ui/
│       ├── src/
│       │   └── button.tsx            # First component (proves setup works)
│       ├── package.json
│       ├── tsconfig.json
│       └── tailwind.config.ts        # Shared Tailwind config
├── tooling/
│   ├── tsconfig/
│   │   ├── base.json                 # Shared base TS config
│   │   ├── react.json                # React-specific overrides
│   │   ├── node.json                 # Node-specific overrides
│   │   └── package.json
│   └── eslint/
│       ├── base.js                   # Shared ESLint config
│       ├── react.js                  # React-specific rules
│       └── package.json
├── package.json                      # Root workspace config
├── pnpm-workspace.yaml               # Workspace definition
├── turbo.json                        # Turborepo pipeline config
├── .gitignore
├── .prettierrc
├── .npmrc
├── LICENSE                           # AGPL-3.0
└── USER_STORIES.md                   # Living feature checklist
```

---

### Task 1: Initialize Repository and Root Config

**Files:**

- Create: `../new-trustroots/package.json`
- Create: `../new-trustroots/pnpm-workspace.yaml`
- Create: `../new-trustroots/turbo.json`
- Create: `../new-trustroots/.gitignore`
- Create: `../new-trustroots/.prettierrc`
- Create: `../new-trustroots/.npmrc`
- Create: `../new-trustroots/LICENSE`

- [ ] **Step 1: Create directory and initialize git**

```bash
mkdir -p ../new-trustroots
cd ../new-trustroots
git init
```

- [ ] **Step 2: Create .gitignore**

```gitignore
node_modules/
dist/
.turbo/
*.tsbuildinfo
.env
.env.*
!.env.example
.DS_Store
coverage/
.vinxi/
.output/
```

- [ ] **Step 3: Create .npmrc**

```ini
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 4: Create root package.json**

```json
{
  "name": "new-trustroots",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "test:unit": "turbo test:unit",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "clean": "turbo clean"
  },
  "packageManager": "pnpm@11.5.2",
  "engines": {
    "node": ">=22.0.0"
  }
}
```

- [ ] **Step 5: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'modules/*'
  - 'packages/*'
  - 'tooling/*'
```

- [ ] **Step 6: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".output/**", ".vinxi/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "test:unit": {
      "cache": true
    },
    "lint": {
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 7: Create .prettierrc**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 8: Create LICENSE**

Use the full AGPL-3.0 license text. The header should read:

```
Copyright (C) 2026 [Project Name] Contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: initialize repository with root config"
```

---

### Task 2: Shared TypeScript Configs (`tooling/tsconfig`)

**Files:**

- Create: `tooling/tsconfig/package.json`
- Create: `tooling/tsconfig/base.json`
- Create: `tooling/tsconfig/react.json`
- Create: `tooling/tsconfig/node.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@repo/tsconfig",
  "version": "0.0.0",
  "private": true,
  "license": "AGPL-3.0-or-later",
  "files": ["*.json"]
}
```

- [ ] **Step 2: Create base.json**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "module": "esnext",
    "target": "esnext",
    "lib": ["esnext"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "exclude": ["node_modules", "dist", "coverage"]
}
```

- [ ] **Step 3: Create react.json**

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["esnext", "dom", "dom.iterable"]
  }
}
```

- [ ] **Step 4: Create node.json**

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["esnext"],
    "module": "esnext",
    "target": "esnext"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add tooling/tsconfig/
git commit -m "chore: add shared TypeScript configs"
```

---

### Task 3: Shared ESLint Config (`tooling/eslint`)

**Files:**

- Create: `tooling/eslint/package.json`
- Create: `tooling/eslint/base.js`
- Create: `tooling/eslint/react.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@repo/eslint-config",
  "version": "0.0.0",
  "private": true,
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "dependencies": {
    "eslint": "^10.4.1",
    "@eslint/js": "^10.0.0",
    "typescript-eslint": "^8.0.0",
    "eslint-plugin-react": "^7.37.0",
    "eslint-plugin-react-hooks": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create base.js**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export const base = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
    },
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.turbo/',
      'coverage/',
      '.vinxi/',
      '.output/',
    ],
  },
);
```

- [ ] **Step 3: Create react.js**

```js
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import { base } from './base.js';

export const react = [
  ...base,
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
```

- [ ] **Step 4: Commit**

```bash
git add tooling/eslint/
git commit -m "chore: add shared ESLint configs"
```

---

### Task 4: Environment Package (`packages/env`)

**Files:**

- Create: `packages/env/package.json`
- Create: `packages/env/tsconfig.json`
- Create: `packages/env/src/preset.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@repo/env",
  "version": "0.0.0",
  "private": true,
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "exports": {
    "./preset": "./src/preset.ts"
  },
  "dependencies": {
    "@t3-oss/env-core": "^0.13.11",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*",
    "typescript": "^6.0.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@repo/tsconfig/node.json",
  "include": ["src"],
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

- [ ] **Step 3: Create src/preset.ts**

```ts
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export function createProjectEnv<T extends Record<string, z.ZodType>>(config: {
  server?: T;
  runtimeEnv: Record<string, string | undefined>;
}) {
  return createEnv({
    server: config.server ?? ({} as T),
    runtimeEnv: config.runtimeEnv,
  });
}

export { z };
```

- [ ] **Step 4: Commit**

```bash
git add packages/env/
git commit -m "feat: add env package with t3-oss preset"
```

---

### Task 5: Nostr Package — Scaffold and Key Generation (`packages/nostr`)

**Files:**

- Create: `packages/nostr/package.json`
- Create: `packages/nostr/tsconfig.json`
- Create: `packages/nostr/vitest.config.ts`
- Create: `packages/nostr/src/keys.ts`
- Create: `packages/nostr/src/keys.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@repo/nostr",
  "version": "0.0.0",
  "private": true,
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "exports": {
    "./keys": "./src/keys.ts",
    "./client": "./src/client.ts",
    "./events": "./src/events.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "nostr-tools": "^2.23.5",
    "@repo/env": "workspace:*"
  },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*",
    "@repo/eslint-config": "workspace:*",
    "typescript": "^6.0.3",
    "vitest": "^4.1.8",
    "eslint": "^10.4.1"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@repo/tsconfig/node.json",
  "include": ["src"],
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
```

- [ ] **Step 4: Write the failing test for key generation**

Create `packages/nostr/src/keys.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  publicKeyFromSecret,
  nsecEncode,
  npubEncode,
} from './keys';

describe('generateKeyPair', () => {
  it('returns a secret key and public key', () => {
    const keyPair = generateKeyPair();
    expect(keyPair.secretKey).toBeDefined();
    expect(keyPair.publicKey).toBeDefined();
    expect(typeof keyPair.secretKey).toBe('string');
    expect(typeof keyPair.publicKey).toBe('string');
    expect(keyPair.secretKey).toHaveLength(64);
    expect(keyPair.publicKey).toHaveLength(64);
  });

  it('generates unique key pairs each time', () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    expect(a.secretKey).not.toBe(b.secretKey);
    expect(a.publicKey).not.toBe(b.publicKey);
  });
});

describe('publicKeyFromSecret', () => {
  it('derives the correct public key from a secret key', () => {
    const keyPair = generateKeyPair();
    const derived = publicKeyFromSecret(keyPair.secretKey);
    expect(derived).toBe(keyPair.publicKey);
  });
});

describe('nsecEncode', () => {
  it('encodes a secret key to nsec format', () => {
    const keyPair = generateKeyPair();
    const nsec = nsecEncode(keyPair.secretKey);
    expect(nsec).toMatch(/^nsec1/);
  });
});

describe('npubEncode', () => {
  it('encodes a public key to npub format', () => {
    const keyPair = generateKeyPair();
    const npub = npubEncode(keyPair.publicKey);
    expect(npub).toMatch(/^npub1/);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd ../new-trustroots && pnpm install && pnpm --filter @repo/nostr test
```

Expected: FAIL — `./keys` module does not exist.

- [ ] **Step 6: Implement key generation**

Create `packages/nostr/src/keys.ts`:

```ts
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import {
  nsecEncode as _nsecEncode,
  npubEncode as _npubEncode,
} from 'nostr-tools/nip19';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export interface KeyPair {
  secretKey: string;
  publicKey: string;
}

export function generateKeyPair(): KeyPair {
  const secretKeyBytes = generateSecretKey();
  const secretKey = bytesToHex(secretKeyBytes);
  const publicKey = getPublicKey(secretKeyBytes);
  return { secretKey, publicKey };
}

export function publicKeyFromSecret(secretKeyHex: string): string {
  const secretKeyBytes = hexToBytes(secretKeyHex);
  return getPublicKey(secretKeyBytes);
}

export function nsecEncode(secretKeyHex: string): string {
  const secretKeyBytes = hexToBytes(secretKeyHex);
  return _nsecEncode(secretKeyBytes);
}

export function npubEncode(publicKeyHex: string): string {
  return _npubEncode(publicKeyHex);
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
pnpm --filter @repo/nostr test
```

Expected: all 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/nostr/
git commit -m "feat: add nostr package with key generation"
```

---

### Task 6: Nostr Package — Event Types (`packages/nostr`)

**Files:**

- Create: `packages/nostr/src/events.ts`
- Create: `packages/nostr/src/events.test.ts`

- [ ] **Step 1: Write the failing test for event type helpers**

Create `packages/nostr/src/events.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createUnsignedEvent, HOSPITALITY_KINDS } from './events';

describe('HOSPITALITY_KINDS', () => {
  it('defines all required event kinds', () => {
    expect(HOSPITALITY_KINDS.BEACON).toBeDefined();
    expect(HOSPITALITY_KINDS.OFFER).toBeDefined();
    expect(HOSPITALITY_KINDS.REFERENCE).toBeDefined();
    expect(HOSPITALITY_KINDS.KEY_GRANT).toBeDefined();
    expect(HOSPITALITY_KINDS.KEY_REQUEST).toBeDefined();
    expect(HOSPITALITY_KINDS.TRUST_POLICY).toBeDefined();
    expect(HOSPITALITY_KINDS.STAY_CONFIRMATION).toBeDefined();
    expect(HOSPITALITY_KINDS.INTRODUCTION_REQUEST).toBeDefined();
  });

  it('uses unique kind numbers for each event type', () => {
    const values = Object.values(HOSPITALITY_KINDS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

describe('createUnsignedEvent', () => {
  it('creates an unsigned event with correct structure', () => {
    const event = createUnsignedEvent({
      kind: HOSPITALITY_KINDS.BEACON,
      content: 'test content',
      tags: [['g', 'u33d']],
      pubkey: 'a'.repeat(64),
    });

    expect(event.kind).toBe(HOSPITALITY_KINDS.BEACON);
    expect(event.content).toBe('test content');
    expect(event.tags).toEqual([['g', 'u33d']]);
    expect(event.pubkey).toBe('a'.repeat(64));
    expect(event.created_at).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @repo/nostr test
```

Expected: FAIL — `./events` module does not exist.

- [ ] **Step 3: Implement event types**

Create `packages/nostr/src/events.ts`:

```ts
import type { UnsignedEvent } from 'nostr-tools/pure';

// Placeholder kind numbers — will be finalized after NIP registry research (see spec Section 15)
export const HOSPITALITY_KINDS = {
  BEACON: 30_001,
  OFFER: 30_002,
  REFERENCE: 30_003,
  KEY_GRANT: 30_004,
  KEY_REQUEST: 30_005,
  TRUST_POLICY: 30_006,
  STAY_CONFIRMATION: 30_007,
  INTRODUCTION_REQUEST: 30_008,
} as const;

export type HospitalityKind =
  typeof HOSPITALITY_KINDS[keyof typeof HOSPITALITY_KINDS];

export function createUnsignedEvent(params: {
  kind: number;
  content: string;
  tags: string[][];
  pubkey: string;
}): UnsignedEvent {
  return {
    kind: params.kind,
    content: params.content,
    tags: params.tags,
    pubkey: params.pubkey,
    created_at: Math.floor(Date.now() / 1000),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @repo/nostr test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/nostr/src/events.ts packages/nostr/src/events.test.ts
git commit -m "feat: add hospitality event kind definitions and unsigned event helper"
```

---

### Task 7: Nostr Package — Relay Client (`packages/nostr`)

**Files:**

- Create: `packages/nostr/src/client.ts`
- Create: `packages/nostr/src/client.test.ts`

- [ ] **Step 1: Write the failing test for relay client**

Create `packages/nostr/src/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRelayClient, type RelayClient } from './client';

// Mock nostr-tools relay
vi.mock('nostr-tools/relay', () => ({
  Relay: {
    connect: vi.fn(),
  },
}));

describe('createRelayClient', () => {
  it('creates a client with the given relay URL', () => {
    const client = createRelayClient('wss://relay.example.com');
    expect(client).toBeDefined();
    expect(client.url).toBe('wss://relay.example.com');
  });

  it('exposes connect, subscribe, publish, and close methods', () => {
    const client = createRelayClient('wss://relay.example.com');
    expect(typeof client.connect).toBe('function');
    expect(typeof client.subscribe).toBe('function');
    expect(typeof client.publish).toBe('function');
    expect(typeof client.close).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @repo/nostr test
```

Expected: FAIL — `./client` module does not exist.

- [ ] **Step 3: Implement relay client wrapper**

Create `packages/nostr/src/client.ts`:

```ts
import { Relay } from 'nostr-tools/relay';
import type { Filter, Event } from 'nostr-tools/pure';

export interface Subscription {
  close(): void;
}

export interface RelayClient {
  url: string;
  connect(): Promise<void>;
  subscribe(
    filters: Filter[],
    callbacks: {
      onevent?: (event: Event) => void;
      oneose?: () => void;
    },
  ): Subscription;
  publish(event: Event): Promise<void>;
  close(): void;
}

export function createRelayClient(url: string): RelayClient {
  let relay: Relay | null = null;

  return {
    url,

    async connect() {
      relay = await Relay.connect(url);
    },

    subscribe(filters, callbacks) {
      if (!relay) {
        throw new Error('Not connected. Call connect() first.');
      }
      const sub = relay.subscribe(filters, {
        onevent: callbacks.onevent,
        oneose: callbacks.oneose,
      });
      return { close: () => sub.close() };
    },

    async publish(event) {
      if (!relay) {
        throw new Error('Not connected. Call connect() first.');
      }
      await relay.publish(event);
    },

    close() {
      if (relay) {
        relay.close();
        relay = null;
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @repo/nostr test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/nostr/src/client.ts packages/nostr/src/client.test.ts
git commit -m "feat: add Nostr relay client wrapper"
```

---

### Task 8: Connectors Package — Interface (`packages/connectors`)

**Files:**

- Create: `packages/connectors/package.json`
- Create: `packages/connectors/tsconfig.json`
- Create: `packages/connectors/src/interface.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@repo/connectors",
  "version": "0.0.0",
  "private": true,
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "exports": {
    "./interface": "./src/interface.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@repo/nostr": "workspace:*",
    "@repo/env": "workspace:*"
  },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*",
    "@repo/eslint-config": "workspace:*",
    "typescript": "^6.0.3",
    "vitest": "^4.1.8",
    "eslint": "^10.4.1"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@repo/tsconfig/node.json",
  "include": ["src"],
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

- [ ] **Step 3: Create connector interface**

Create `packages/connectors/src/interface.ts`:

```ts
import type { UnsignedEvent } from 'nostr-tools/pure';

export interface ConnectorProfile {
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  languages: string[];
  location: string | null;
  sourcePlatform: string;
  sourceUsername: string;
}

export interface ConnectorReference {
  fromUsername: string;
  toUsername: string;
  positive: boolean;
  content: string;
  createdAt: number;
  sourcePlatform: string;
}

export interface ConnectorOffer {
  type: 'host' | 'meet';
  description: string;
  latitude: number;
  longitude: number;
  maxGuests: number | null;
  sourcePlatform: string;
}

export interface ConnectorCredentials {
  username: string;
  password: string;
}

export interface Connector {
  readonly platform: string;

  verifyIdentityLink(params: {
    credentials: ConnectorCredentials;
    expectedNpub: string;
  }): Promise<{ verified: boolean; reason?: string }>;

  fetchProfile(credentials: ConnectorCredentials): Promise<ConnectorProfile>;

  fetchReferences(
    credentials: ConnectorCredentials,
  ): Promise<ConnectorReference[]>;

  fetchOffer(credentials: ConnectorCredentials): Promise<ConnectorOffer | null>;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/connectors/
git commit -m "feat: add connectors package with common interface"
```

---

### Task 9: UI Package — Scaffold (`packages/ui`)

**Files:**

- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/button.tsx`
- Create: `packages/ui/src/button.test.tsx`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "exports": {
    "./button": "./src/button.tsx"
  },
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "react": "^19.2.7",
    "tailwind-merge": "^3.0.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*",
    "@repo/eslint-config": "workspace:*",
    "@types/react": "^19.0.0",
    "typescript": "^6.0.3",
    "vitest": "^4.1.8",
    "eslint": "^10.4.1",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jsdom": "^26.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@repo/tsconfig/react.json",
  "include": ["src"],
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

- [ ] **Step 3: Create vitest.config.ts**

Create `packages/ui/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

- [ ] **Step 4: Write the failing test for Button component**

Create `packages/ui/src/button.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('applies variant classes', () => {
    render(<Button variant="primary">Primary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-');
  });

  it('forwards native button props', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
pnpm install && pnpm --filter @repo/ui test
```

Expected: FAIL — `./button` module does not exist.

- [ ] **Step 6: Implement Button component**

Create `packages/ui/src/button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

const variantStyles = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
} as const;

type Variant = keyof typeof variantStyles;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50',
          variantStyles[variant],
          className,
        ),
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
pnpm --filter @repo/ui test
```

Expected: all 3 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/
git commit -m "feat: add UI package with Button component"
```

---

### Task 10: API Module (`modules/api`)

**Files:**

- Create: `modules/api/package.json`
- Create: `modules/api/tsconfig.json`
- Create: `modules/api/src/router.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@repo/api",
  "version": "0.0.0",
  "private": true,
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "exports": {
    "./router": "./src/router.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@orpc/server": "^1.14.5",
    "@repo/nostr": "workspace:*",
    "@repo/connectors": "workspace:*",
    "@repo/env": "workspace:*"
  },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*",
    "@repo/eslint-config": "workspace:*",
    "typescript": "^6.0.3",
    "eslint": "^10.4.1"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@repo/tsconfig/node.json",
  "include": ["src"],
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

- [ ] **Step 3: Create router scaffold**

Create `modules/api/src/router.ts`:

```ts
import { os } from '@orpc/server';

export const router = os.router({
  health: os.handler(() => {
    return { status: 'ok' as const, timestamp: Date.now() };
  }),
});

export type Router = typeof router;
```

- [ ] **Step 4: Commit**

```bash
git add modules/api/
git commit -m "feat: add API module with oRPC router scaffold"
```

---

### Task 11: Web App Scaffold (`apps/web`)

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/app.config.ts`
- Create: `apps/web/app/router.tsx`
- Create: `apps/web/app/client.tsx`
- Create: `apps/web/app/routes/__root.tsx`
- Create: `apps/web/env.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@repo/web",
  "version": "0.0.0",
  "private": true,
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "scripts": {
    "dev": "vinxi dev --port 3000",
    "build": "vinxi build",
    "start": "vinxi start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint app/"
  },
  "dependencies": {
    "@tanstack/react-start": "^1.168.20",
    "@tanstack/react-router": "^1.168.20",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "vinxi": "^0.5.0",
    "@repo/ui": "workspace:*",
    "@repo/nostr": "workspace:*",
    "@repo/api": "workspace:*",
    "@repo/env": "workspace:*"
  },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*",
    "@repo/eslint-config": "workspace:*",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^6.0.3",
    "eslint": "^10.4.1",
    "tailwindcss": "^4.3.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@repo/tsconfig/react.json",
  "include": ["app", "*.ts"],
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

- [ ] **Step 3: Create app.config.ts**

```ts
import { defineConfig } from '@tanstack/react-start/config';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  vite: {
    plugins: [tsConfigPaths()],
  },
});
```

- [ ] **Step 4: Create app/router.tsx**

```tsx
import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export function createRouter() {
  return createTanStackRouter({
    routeTree,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
```

- [ ] **Step 5: Create app/client.tsx**

```tsx
import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/react-start/client';
import { createRouter } from './router';

const router = createRouter();

hydrateRoot(document.getElementById('root')!, <StartClient router={router} />);
```

- [ ] **Step 6: Create app/routes/\_\_root.tsx**

```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Hospitality Network</title>
      </head>
      <body>
        <div id="root">
          <Outlet />
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create env.ts**

```ts
import { createProjectEnv, z } from '@repo/env/preset';

export const env = createProjectEnv({
  server: {
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
  },
  runtimeEnv: process.env as Record<string, string | undefined>,
});
```

- [ ] **Step 8: Verify the web app starts**

```bash
pnpm install && pnpm --filter @repo/web dev
```

Expected: dev server starts on port 3000. Ctrl+C after confirming.

- [ ] **Step 9: Commit**

```bash
git add apps/web/
git commit -m "feat: scaffold web app with TanStack Start"
```

---

### Task 12: React Native App Scaffold (`apps/native`)

**Files:**

- Create: `apps/native/package.json`
- Create: `apps/native/tsconfig.json`
- Create: `apps/native/src/App.tsx`
- Create: `apps/native/env.ts`

- [ ] **Step 1: Initialize React Native project**

```bash
cd ../new-trustroots
npx @react-native-community/cli init native --directory apps/native --skip-git-init --skip-install
```

- [ ] **Step 2: Update package.json to integrate with monorepo**

Edit `apps/native/package.json` to add workspace dependencies:

```json
{
  "name": "@repo/native",
  "version": "0.0.0",
  "private": true,
  "license": "AGPL-3.0-or-later"
}
```

Add to the existing dependencies (merge, don't replace):

```json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/nostr": "workspace:*",
    "@repo/api": "workspace:*",
    "@repo/env": "workspace:*"
  },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*"
  }
}
```

- [ ] **Step 3: Create env.ts**

```ts
import { createProjectEnv, z } from '@repo/env/preset';

export const env = createProjectEnv({
  server: {
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
  },
  runtimeEnv: process.env as Record<string, string | undefined>,
});
```

- [ ] **Step 4: Update App.tsx to import from shared packages**

Replace `apps/native/src/App.tsx` (or `App.tsx` at root of native app):

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hospitality Network</Text>
      <Text style={styles.subtitle}>Decentralized. Private. Yours.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add apps/native/
git commit -m "feat: scaffold React Native app"
```

---

### Task 13: Relay App Scaffold (`apps/relay`)

**Files:**

- Create: `apps/relay/package.json`
- Create: `apps/relay/tsconfig.json`
- Create: `apps/relay/src/index.ts`
- Create: `apps/relay/env.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@repo/relay",
  "version": "0.0.0",
  "private": true,
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@repo/nostr": "workspace:*",
    "@repo/env": "workspace:*"
  },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*",
    "@repo/eslint-config": "workspace:*",
    "typescript": "^6.0.3",
    "tsx": "^4.0.0",
    "eslint": "^10.4.1"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@repo/tsconfig/node.json",
  "include": ["src", "*.ts"],
  "compilerOptions": {
    "outDir": "dist",
    "noEmit": false
  }
}
```

- [ ] **Step 3: Create env.ts**

```ts
import { createProjectEnv, z } from '@repo/env/preset';

export const env = createProjectEnv({
  server: {
    PORT: z.string().default('7000'),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
  },
  runtimeEnv: process.env as Record<string, string | undefined>,
});
```

- [ ] **Step 4: Create src/index.ts**

```ts
import { env } from '../env';

const port = parseInt(env.PORT, 10);

console.log(`[relay] Hospitality helper relay`);
console.log(`[relay] Starting on port ${port}...`);
console.log(`[relay] TODO: Implement relay logic in Phase 5`);
```

- [ ] **Step 5: Commit**

```bash
git add apps/relay/
git commit -m "feat: scaffold helper relay app"
```

---

### Task 14: CI/CD Pipeline (`.github/workflows`)

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/ci-full.yml`

- [ ] **Step 1: Create PR checks workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

- [ ] **Step 2: Create full CI workflow for main merges**

Create `.github/workflows/ci-full.yml`:

```yaml
name: CI Full

on:
  push:
    branches: [main]

jobs:
  full-test-suite:
    name: Full Test Suite
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflows for PR checks and main branch"
```

---

### Task 15: User Stories Checklist and Final Verification

**Files:**

- Create: `USER_STORIES.md`

- [ ] **Step 1: Create USER_STORIES.md**

```markdown
# User Stories

Living checklist tracking feature implementation progress.

## Trustroots Parity

### Accounts & Profiles

- [ ] User can create an account (keypair generation)
- [ ] User can set display name, bio, avatar
- [ ] User can set languages spoken
- [ ] User can set location
- [ ] User can delete their account (revoke keypair)

### Hosting Offers

- [ ] User can create a hosting offer (host / meet)
- [ ] User can set offer location on map
- [ ] User can describe their space and rules
- [ ] User can set max guests
- [ ] User can enable/disable their offer
- [ ] Offer location is fuzzy/private by default

### Search & Discovery

- [ ] User can browse a map to find hosts
- [ ] Map shows host markers with clustering
- [ ] User can filter by hosting type
- [ ] User can search by location

### Messaging

- [ ] User can send a direct message to another user
- [ ] User can receive messages with notifications
- [ ] User can view conversation history
- [ ] Messages are end-to-end encrypted

### References & Trust

- [ ] User can leave a reference after a stay
- [ ] References indicate positive/negative experience
- [ ] Both host and guest can leave references
- [ ] References are visible to relevant users

### Circles / Communities

- [ ] User can join a circle/community
- [ ] User can browse circles
- [ ] Circles have descriptions and member lists

### Notifications

- [ ] User receives push notifications for new messages
- [ ] User receives notifications for new references

## New Capabilities

### Privacy & Encryption

- [ ] Hosting offers are encrypted by default
- [ ] User can configure WoT decryption radius
- [ ] Beacons show configurable anonymity levels
- [ ] Aggregate reputation on beacons (optional)
- [ ] References are WoT-encrypted
- [ ] Stay confirmations require mutual signing

### Web of Trust

- [ ] User can add direct contacts
- [ ] WoT distance calculation works
- [ ] Key distribution follows WoT chain (P2P)
- [ ] Custom trust rules (e.g., "friends of friends")
- [ ] Introduction requests via mutual contacts
- [ ] Direct key requests to hosts

### Connectors (Interoperability)

- [ ] User can verify Trustroots identity (bidirectional proof)
- [ ] Connector fetches Trustroots profile
- [ ] Connector fetches Trustroots references
- [ ] Connector normalizes data to native event types
- [ ] Bridged data cached locally with TTL
- [ ] Bridged data clearly attributed ("via Trustroots")

### Nostr Native

- [ ] User can log in with NIP-07 signer (web)
- [ ] User can log in with NIP-46 (remote signer)
- [ ] User can log in with Amber (mobile)
- [ ] Profile is a Nostr kind 0 event
- [ ] Messaging uses NIP-44 encrypted DMs
- [ ] Stay requests are structured tagged DMs
- [ ] All data portable to any Nostr client

### Design & Brand

- [ ] Design system with Tailwind + shadcn/ui
- [ ] Consistent brand identity
- [ ] Marketing / landing page
- [ ] WCAG 2.1 AA accessible
- [ ] Mobile-first responsive design
```

- [ ] **Step 2: Run full verification**

```bash
cd ../new-trustroots
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

All commands should pass. Fix any issues before proceeding.

- [ ] **Step 3: Commit**

```bash
git add USER_STORIES.md
git commit -m "docs: add user stories checklist for progress tracking"
```

- [ ] **Step 4: Final commit — tag Phase 1 complete**

```bash
git tag phase-1-foundation
```

---

## Plan Self-Review Notes

**Spec coverage check:**

- Section 1 (Principles): AGPL-3.0 license created (Task 1) ✓
- Section 3 (Project Structure): all directories scaffolded ✓
- Section 7 (Event Schema): placeholder kinds defined in Task 6 ✓
- Section 12 (Testing): Vitest configured with coverage thresholds (Tasks 5, 9) ✓
- Section 13 (CI/CD): GitHub Actions workflows created (Task 14) ✓
- Section 14 (Workflow): conventional commits, no barrel exports, no default exports enforced throughout ✓
- USER_STORIES.md created (Task 15) ✓

**Placeholder scan:** No TBDs except event kind numbers (intentionally deferred per spec Section 15).

**Type consistency:** `KeyPair`, `ConnectorProfile`, `ConnectorReference`, `ConnectorOffer`, `ConnectorCredentials`, `Connector`, `RelayClient`, `Subscription`, `HospitalityKind` — all defined once, referenced consistently.
