---
layout: default
title: Mobile apps
description: Trustroots and Nostroots apps for Android and iOS.
permalink: /apps/
---

# Mobile apps

Release times are in UTC. The Trustroots Android release is checked automatically
when you open this page. Versions are listed separately for each download channel.

<h2 id="trustroots-android">Trustroots</h2>

Find travellers, discover circles and share hospitality.

- <a id="android-preview-link" href="{{ site.data.android_releases.download.url }}">Download the latest Android build</a><span id="android-preview-version"> — version {{ site.data.android_releases.download.version }}</span><span id="android-preview-updated"> — updated <time id="android-preview-time" datetime="{{ site.data.android_releases.download.published }}">{{ site.data.android_releases.download.published | date: "%Y-%m-%d %H:%M" }}</time></span>
- <a href="https://zapstore.dev/apps/org.trustroots.android">Get Android preview updates with Zapstore</a><span id="android-zapstore-version"> — version {{ site.data.android_releases.zapstore.version }}</span>
- [Read the iOS build guide](https://github.com/Trustroots/trustroots/blob/main/apps/ios/README.md)

The Android download is a signed preview build, updated from the main branch.

<script src="/assets/js/latest-apk.mjs" type="module"></script>

In Zapstore, select the beta channel for Android preview releases.

<details>
  <summary>Publish an Android preview to Zapstore (maintainers)</summary>
  <p>Publish the prepared signed APK using the Trustroots Nostr browser signing extension.</p>
  <p id="zapstore-candidate" style="overflow-wrap: anywhere"></p>
  <p>Publication is subject to the <a href="https://zapstore.dev/terms">Zapstore catalogue terms</a>.</p>
  <button id="zapstore-publish" type="button" disabled>Publish preview to Zapstore</button>
  <p id="zapstore-publish-status" role="status" aria-live="polite">Loading the prepared preview…</p>
</details>

<script src="/assets/js/apps.mjs" type="module"></script>

To receive updates, install [Obtainium](https://obtainium.imranr.dev/) and
[add Trustroots to Obtainium](obtainium://app/%7B%22id%22%3A%22org.trustroots.android%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2FTrustroots%2Ftrustroots%22%2C%22author%22%3A%22Trustroots%22%2C%22name%22%3A%22Trustroots%20Android%20preview%22%2C%22additionalSettings%22%3A%22%7B%5C%22includePrereleases%5C%22%3Atrue%2C%5C%22filterReleaseTitlesByRegEx%5C%22%3A%5C%22%5EAndroid%20preview%20%5C%22%2C%5C%22apkFilterRegEx%5C%22%3A%5C%22%5Etrustroots-android-.*%5C%5C%5C%5C.apk%24%5C%22%7D%22%7D). Confirm the import to follow the signed
Android preview APKs from GitHub. If the link does not open, add
`https://github.com/Trustroots/trustroots` in Obtainium and enable prereleases.

<figure class="apps-qr">
  <a href="/apps/latest-apk/">
    <img src="/assets/img/apps/trustroots-latest-apk-qr.svg" alt="QR code to download the latest Trustroots Android build" width="132" height="132" />
  </a>
  <figcaption>Scan to download the latest Android build.</figcaption>
</figure>

## Nostroots

Explore our Nostr-based community app.

- [Nostroots for iOS on the App Store](https://apps.apple.com/us/app/nostroots/id6755037304) — updated <time datetime="2026-06-17T19:20:22Z">2026-06-17 19:20</time>
- [Nostroots for Android on Google Play](https://play.google.com/store/apps/details?id=org.trustroots.nostroots) — updated <time datetime="2026-06-17T14:22:20Z">2026-06-17 14:22</time>
