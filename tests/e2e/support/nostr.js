/**
 * Install a deterministic Nostr relay stub on the page.
 *
 * The Trustroots client talks to `wss://relay.trustroots.org` via nostr-tools.
 * This stub replaces `window.WebSocket` for that relay URL with an in-page mock
 * that answers every `REQ` subscription with the supplied (already-signed)
 * events followed by an `EOSE`, keeping e2e runs offline and deterministic.
 *
 * Events must be valid, signed Nostr events (e.g. produced with
 * nostr-tools `finalizeEvent`) because nostr-tools verifies signatures before
 * delivering them to subscribers.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {object[]} [options.events] signed Nostr events to return on each REQ
 */
async function installNostrRelayStub(page, { events = [] } = {}) {
  /* global window */
  await page.addInitScript(relayEvents => {
    const NativeWebSocket = window.WebSocket;

    function createEvent(type, target, extra = {}) {
      return { type, target, currentTarget: target, ...extra };
    }

    function MockRelayWebSocket(url) {
      this.url = String(url);
      this.readyState = MockRelayWebSocket.CONNECTING;
      this.protocol = '';
      this.extensions = '';
      this.binaryType = 'blob';
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;
      this.listeners = {
        open: new Set(),
        message: new Set(),
        error: new Set(),
        close: new Set(),
      };

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
      if (this.listeners[type]) {
        this.listeners[type].add(listener);
      }
    };

    MockRelayWebSocket.prototype.removeEventListener =
      function removeEventListener(type, listener) {
        if (this.listeners[type]) {
          this.listeners[type].delete(listener);
        }
      };

    MockRelayWebSocket.prototype.dispatchEvent = function dispatchEvent(event) {
      const handler = this[`on${event.type}`];
      if (typeof handler === 'function') {
        handler.call(this, event);
      }
      if (this.listeners[event.type]) {
        this.listeners[event.type].forEach(listener => {
          listener.call(this, event);
        });
      }
      return true;
    };

    MockRelayWebSocket.prototype.send = function send(data) {
      if (this.readyState !== MockRelayWebSocket.OPEN) return;

      let message;
      try {
        message = JSON.parse(data);
      } catch (e) {
        return;
      }

      if (Array.isArray(message) && message[0] === 'REQ') {
        const subscriptionId = message[1];
        window.setTimeout(() => {
          if (this.readyState !== MockRelayWebSocket.OPEN) return;
          relayEvents.forEach(relayEvent => {
            this.dispatchEvent(
              createEvent('message', this, {
                data: JSON.stringify(['EVENT', subscriptionId, relayEvent]),
              }),
            );
          });
          this.dispatchEvent(
            createEvent('message', this, {
              data: JSON.stringify(['EOSE', subscriptionId]),
            }),
          );
        }, 0);
      }
    };

    MockRelayWebSocket.prototype.close = function close(code, reason) {
      if (this.readyState === MockRelayWebSocket.CLOSED) return;
      this.readyState = MockRelayWebSocket.CLOSED;
      this.dispatchEvent(
        createEvent('close', this, {
          code: code || 1000,
          reason: reason || '',
          wasClean: true,
        }),
      );
    };

    window.WebSocket = function WebSocket(url, protocols) {
      if (String(url).startsWith('wss://relay.trustroots.org')) {
        return new MockRelayWebSocket(url);
      }
      return new NativeWebSocket(url, protocols);
    };

    window.WebSocket.CONNECTING = MockRelayWebSocket.CONNECTING;
    window.WebSocket.OPEN = MockRelayWebSocket.OPEN;
    window.WebSocket.CLOSING = MockRelayWebSocket.CLOSING;
    window.WebSocket.CLOSED = MockRelayWebSocket.CLOSED;
  }, events);
}

module.exports = {
  installNostrRelayStub,
};
