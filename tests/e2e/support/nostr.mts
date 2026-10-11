import type { Page } from '@playwright/test';

export type SignedNostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
};

export type NostrRelayStubOptions = {
  events?: SignedNostrEvent[];
  relayUrl?: string;
  unavailable?: boolean;
};

/**
 * Install a deterministic Nostr relay stub on the page. The supplied signed
 * events are returned for each REQ subscription, followed by an EOSE message.
 */
export async function installNostrRelayStub(
  page: Page,
  {
    events = [],
    relayUrl = 'wss://relay.trustroots.org',
    unavailable = false,
  }: NostrRelayStubOptions = {},
): Promise<void> {
  await page.addInitScript(
    ({
      relayEvents,
      relayUrl: targetRelayUrl,
      unavailable: relayUnavailable,
    }) => {
      const NativeWebSocket = window.WebSocket;

      class MockRelayWebSocket extends EventTarget implements WebSocket {
        static readonly CONNECTING = 0;
        static readonly OPEN = 1;
        static readonly CLOSING = 2;
        static readonly CLOSED = 3;

        readonly url: string;
        readonly CONNECTING = MockRelayWebSocket.CONNECTING;
        readonly OPEN = MockRelayWebSocket.OPEN;
        readonly CLOSING = MockRelayWebSocket.CLOSING;
        readonly CLOSED = MockRelayWebSocket.CLOSED;
        readyState: 0 | 1 | 2 | 3 = MockRelayWebSocket.CONNECTING;
        protocol = '';
        extensions = '';
        bufferedAmount = 0;
        binaryType: BinaryType = 'blob';
        onopen: ((this: WebSocket, event: Event) => unknown) | null = null;
        onmessage: ((this: WebSocket, event: MessageEvent) => unknown) | null =
          null;
        onerror: ((this: WebSocket, event: Event) => unknown) | null = null;
        onclose: ((this: WebSocket, event: CloseEvent) => unknown) | null =
          null;

        constructor(url: string | URL) {
          super();
          this.url = String(url);
          window.setTimeout(() => {
            if (this.readyState !== MockRelayWebSocket.CONNECTING) return;
            this.readyState = MockRelayWebSocket.OPEN;
            this.emit(new Event('open'));
          }, 0);
        }

        send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
          if (
            this.readyState !== MockRelayWebSocket.OPEN ||
            typeof data !== 'string'
          ) {
            return;
          }

          let message: unknown;
          try {
            message = JSON.parse(data) as unknown;
          } catch {
            return;
          }

          if (
            !Array.isArray(message) ||
            message[0] !== 'REQ' ||
            typeof message[1] !== 'string'
          ) {
            return;
          }

          const subscriptionId = message[1];
          window.setTimeout(() => {
            if (this.readyState !== MockRelayWebSocket.OPEN) return;
            if (relayUnavailable) {
              this.emit(
                new MessageEvent('message', {
                  data: JSON.stringify([
                    'CLOSED',
                    subscriptionId,
                    'fixture unavailable',
                  ]),
                }),
              );
              return;
            }
            for (const relayEvent of relayEvents) {
              this.emit(
                new MessageEvent('message', {
                  data: JSON.stringify(['EVENT', subscriptionId, relayEvent]),
                }),
              );
            }
            this.emit(
              new MessageEvent('message', {
                data: JSON.stringify(['EOSE', subscriptionId]),
              }),
            );
          }, 0);
        }

        close(code = 1000, reason = ''): void {
          if (this.readyState === MockRelayWebSocket.CLOSED) return;
          this.readyState = MockRelayWebSocket.CLOSED;
          this.emit(new CloseEvent('close', { code, reason, wasClean: true }));
        }

        private emit(event: Event): void {
          if (event instanceof MessageEvent) {
            this.onmessage?.call(this, event);
          } else if (event instanceof CloseEvent) {
            this.onclose?.call(this, event);
          } else if (event.type === 'open') {
            this.onopen?.call(this, event);
          } else if (event.type === 'error') {
            this.onerror?.call(this, event);
          }
          super.dispatchEvent(event);
        }
      }

      const replacement = function (
        url: string | URL,
        protocols?: string | string[],
      ): WebSocket {
        if (
          String(url).replace(/\/$/, '') === targetRelayUrl.replace(/\/$/, '')
        ) {
          return new MockRelayWebSocket(url);
        }
        return new NativeWebSocket(url, protocols);
      } as unknown as typeof WebSocket;

      Object.assign(replacement, {
        CONNECTING: MockRelayWebSocket.CONNECTING,
        OPEN: MockRelayWebSocket.OPEN,
        CLOSING: MockRelayWebSocket.CLOSING,
        CLOSED: MockRelayWebSocket.CLOSED,
      });
      window.WebSocket = replacement;
    },
    { relayEvents: events, relayUrl, unavailable },
  );
}

/**
 * Install an in-page relay that answers NIP-46 RPCs for a deterministic local
 * bunker. All request and response events are signed and NIP-44 encrypted; no
 * relay traffic leaves the browser.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} options
 * @param {Uint8Array} options.bunkerSecretKey
 * @param {Uint8Array} options.signerSecretKey
 */
export async function installNostrBunkerStub(
  page,
  { bunkerSecretKey, signerSecretKey },
) {
  const { finalizeEvent, getPublicKey } = require('nostr-tools');
  const nip44 = require('nostr-tools/nip44').v2;
  const conversationKey = new Map();
  const bunkerPubkey = getPublicKey(bunkerSecretKey);
  const signerPubkey = getPublicKey(signerSecretKey);

  await page.exposeFunction('__e2eNostrBunkerEvent', async event => {
    if (event.kind !== 24133 || event.pubkey === bunkerPubkey) return;

    let key = conversationKey.get(event.pubkey);
    if (!key) {
      key = nip44.utils.getConversationKey(bunkerSecretKey, event.pubkey);
      conversationKey.set(event.pubkey, key);
    }
    const payload = JSON.parse(nip44.decrypt(event.content, key));
    const response =
      payload.method === 'connect'
        ? { id: payload.id, result: 'ack' }
        : payload.method === 'get_public_key'
        ? { id: payload.id, result: signerPubkey }
        : payload.method === 'sign_event'
        ? {
            id: payload.id,
            result: JSON.stringify(
              finalizeEvent(JSON.parse(payload.params[0]), signerSecretKey),
            ),
          }
        : payload.method === 'switch_relays'
        ? { id: payload.id, result: JSON.stringify([]) }
        : {
            id: payload.id,
            error: `Unsupported test method: ${payload.method}`,
          };

    const reply = finalizeEvent(
      {
        kind: 24133,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', event.pubkey]],
        content: nip44.encrypt(JSON.stringify(response), key),
      },
      bunkerSecretKey,
    );

    return reply;
  });

  await page.exposeFunction(
    '__e2eCreateNostrConnectHandshake',
    async (pubkey, secret) => {
      return finalizeEvent(
        {
          kind: 24133,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['p', pubkey]],
          content: nip44.encrypt(
            JSON.stringify({ id: 'test-handshake', result: secret }),
            nip44.utils.getConversationKey(bunkerSecretKey, pubkey),
          ),
        },
        bunkerSecretKey,
      );
    },
  );

  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;

    function createEvent(type, target, extra = {}) {
      return { type, target, currentTarget: target, ...extra };
    }

    function MockRelayWebSocket(url) {
      this.url = String(url);
      this.readyState = MockRelayWebSocket.CONNECTING;
      this.listeners = {
        open: new Set(),
        message: new Set(),
        error: new Set(),
        close: new Set(),
      };
      this.__e2eSubs = new Map();
      window.__e2eNostrSockets.add(this);
      window.setTimeout(() => {
        if (this.readyState !== MockRelayWebSocket.CONNECTING) return;
        this.readyState = MockRelayWebSocket.OPEN;
        this.dispatchEvent(createEvent('open', this));
      }, 0);
    }

    MockRelayWebSocket.CONNECTING = 0;
    MockRelayWebSocket.OPEN = 1;
    MockRelayWebSocket.CLOSING = 2;
    MockRelayWebSocket.CLOSED = 3;
    MockRelayWebSocket.prototype.addEventListener = function addEventListener(
      type,
      listener,
    ) {
      this.listeners[type]?.add(listener);
    };
    MockRelayWebSocket.prototype.removeEventListener =
      function removeEventListener(type, listener) {
        this.listeners[type]?.delete(listener);
      };
    MockRelayWebSocket.prototype.dispatchEvent = function dispatchEvent(event) {
      if (typeof this[`on${event.type}`] === 'function')
        this[`on${event.type}`].call(this, event);
      this.listeners[event.type]?.forEach(listener =>
        listener.call(this, event),
      );
      return true;
    };
    MockRelayWebSocket.prototype.__e2eDeliver = function deliver(event, subId) {
      if (this.readyState === MockRelayWebSocket.OPEN) {
        this.dispatchEvent(
          createEvent('message', this, {
            data: JSON.stringify(['EVENT', subId, event]),
          }),
        );
      }
    };
    MockRelayWebSocket.prototype.send = function send(data) {
      if (this.readyState !== MockRelayWebSocket.OPEN) return;
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      if (message[0] === 'REQ') {
        const id = message[1];
        const filter = message[2];
        const sub = {
          id,
          kinds: filter.kinds || [],
          recipients: filter['#p'] || [],
        };
        this.__e2eSubs.set(id, sub);
        window.setTimeout(() => {
          this.dispatchEvent(
            createEvent('message', this, {
              data: JSON.stringify(['EOSE', id]),
            }),
          );
        }, 0);
      } else if (message[0] === 'EVENT') {
        const publishedEvent = message[1];
        this.dispatchEvent(
          createEvent('message', this, {
            data: JSON.stringify([
              'OK',
              publishedEvent.id,
              true,
              'accepted by local test bunker',
            ]),
          }),
        );
        this.dispatchEvent(
          createEvent('message', this, {
            data: JSON.stringify([
              'OK',
              publishedEvent.id,
              true,
              'accepted by local test bunker',
            ]),
          }),
        );
        window.__e2eNostrBunkerEvent(publishedEvent).then(reply => {
          this.__e2eSubs.forEach(sub => {
            if (
              sub.kinds.includes(24133) &&
              (!sub.recipients.length ||
                sub.recipients.includes(publishedEvent.pubkey))
            ) {
              this.__e2eDeliver(reply, sub.id);
            }
          });
        });
      }
    };
    MockRelayWebSocket.prototype.close = function close(code, reason) {
      this.readyState = MockRelayWebSocket.CLOSED;
      window.__e2eNostrSockets.delete(this);
      this.dispatchEvent(
        createEvent('close', this, {
          code: code || 1000,
          reason: reason || '',
          wasClean: true,
        }),
      );
    };

    window.__e2eNostrSockets = window.__e2eNostrSockets || new Set();
    window.__e2eInjectNostrRelayEvent = event => {
      window.__e2eNostrSockets.forEach(socket => {
        socket.__e2eSubs.forEach(sub => {
          if (
            sub.kinds.includes(event.kind) &&
            (!sub.recipients.length ||
              sub.recipients.includes(
                event.tags.find(tag => tag[0] === 'p')?.[1],
              ))
          ) {
            socket.__e2eDeliver(event, sub.id);
          }
        });
      });
    };

    window.WebSocket = function WebSocket(url, protocols) {
      if (String(url).startsWith('wss://relay.trustroots.org'))
        return new MockRelayWebSocket(url);
      return new NativeWebSocket(url, protocols);
    };
    Object.assign(window.WebSocket, {
      CONNECTING: MockRelayWebSocket.CONNECTING,
      OPEN: MockRelayWebSocket.OPEN,
      CLOSING: MockRelayWebSocket.CLOSING,
      CLOSED: MockRelayWebSocket.CLOSED,
    });
  });

  return { bunkerPubkey, signerPubkey };
}

