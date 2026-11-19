# Link the local mobile Nostr key to the member profile

Add explicit link, replace and unlink actions to the Android and iOS Account key section
for #3633. Add a bearer-authenticated challenge route that reuses the website's
ownership proof. Submit the proof to the existing mobile profile update route.
The native app signs only a challenge for its configured API server. Keys stay
in their device stores and the profile still stores only the public key.
