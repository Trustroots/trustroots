# Android account Nostr keys

Android members need local Nostr identities for #3633. Add a key manager to
Account that uses the shared account scope from #3232 and encrypts key material
with Android Keystore. Show the local and profile public keys independently.
Keep Android device authentication and storage in native code. This increment
uses the existing mobile profile response. It adds no server routes or storage
migrations. Profile writes and browser signing are separate increments.
