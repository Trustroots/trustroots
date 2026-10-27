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
  acceptPublishes?: boolean;
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
    acceptPublishes = false,
  }: NostrRelayStubOptions = {},
): Promise<void> {
  await page.addInitScript(
    ({
      relayEvents,
      relayUrl: targetRelayUrl,
      unavailable: relayUnavailable,
      acceptPublishes: relayAcceptPublishes,
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
            Array.isArray(message) &&
            message[0] === 'EVENT' &&
            relayAcceptPublishes
          ) {
            const published = message[1] as SignedNostrEvent;
            window.dispatchEvent(
              new CustomEvent('nostr-test-published', { detail: published }),
            );
            window.setTimeout(
              () =>
                this.emit(
                  new MessageEvent('message', {
                    data: JSON.stringify([
                      'OK',
                      published.id,
                      true,
                      'fixture accepted',
                    ]),
                  }),
                ),
              0,
            );
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
    { relayEvents: events, relayUrl, unavailable, acceptPublishes },
  );
}
