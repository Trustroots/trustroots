# Android embedded Nostr signing

Add the required NIP-07 methods to Android's embedded browser for #3633. Use
WebView's origin and frame metadata, the active native session, and the existing
Keystore identity. Permit the apex and www HTTPS origins for Trustroots and Hitchwiki on the
standard HTTPS port. Require native member approval for each event signature. Add a Radio
shortcut to the signed-in menu. No new relay, server route, or browser credential
sharing is required.
