# Nostroots

**Nostroots** is Trustroots' integration with the [Nostr protocol](https://nostr.com/), bringing decentralized, user-owned social networking features to the hospitality exchange platform.

<div class="toc-box">
<h2>Table of Contents</h2>
<ul>
<li><a href="#what-is-nostroots">What is Nostroots?</a>
<ul>
<li><a href="#our-manifesto-2025">Our Manifesto (2025)</a></li>
<li><a href="#the-nostroots-app">The Nostroots App</a></li>
</ul>
</li>
<li><a href="#getting-started">Getting Started</a>
<ul>
<li><a href="#android">Android</a></li>
<li><a href="#ios">iOS</a></li>
</ul>
</li>
<li><a href="#background--vision">Background & Vision</a></li>
<li><a href="#frequently-asked-questions">Frequently Asked Questions</a>
<ul>
<li><a href="#technology--protocol">Technology & Protocol</a></li>
<li><a href="#development--strategy">Development & Strategy</a></li>
<li><a href="#community--culture">Community & Culture</a></li>
</ul>
</li>
<li><a href="#want-to-help">Want to Help?</a></li>
<li><a href="#resources">Resources</a></li>
</ul>
</div>

---

## What is Nostroots?

Nosroots is the evolution of Trustroots, built on a more open, decentralized protocol, The result is a version of Trustroots that is more open, resilient, and user-empowered.

### Our Manifesto (2025)

<div class="manifesto-box">

<p class="manifesto-statement">
We want a world that encourages trust, adventure, and intercultural connections.
</p>

<p class="manifesto-statement">
Our willingness to help each other is universal.
</p>

<p class="manifesto-statement">
Trustroots is completely free to use — and will remain so forever.
</p>

<p class="manifesto-statement">
We believe in beauty, simplicity, and transparency.
</p>

<p class="manifesto-statement">
We emphasize community and shared ownership.
</p>

<p class="manifesto-statement">
We believe in digital freedom — everyone should have control over their own data.
</p>

</div>

### The Nostroots App

The full transition from Trustroots to Nostroots will happen over the next years, but we are excited to launch an app with the first feature built on Nostroots! Users can:

- Post "notes" on a map to let the community know that something is happening in a particular location
- Subscribe to specific areas to find out about "notes" posted by other community members
- Connect "notes" to specific Trustroots circles

This creates a foundation for decentralized, user-owned social networking within the Trustroots ecosystem, which we hope will enable more innovations in gift economy applications beyond traditional hospitality exchange. We already see two projects coming soon: lightfoot (a letter writing app) and a hitchhiking app.

---

## Want to try it?

### Android

If you're adventurous, you can try the Android APK:

**[Download APK releases from GitHub](https://github.com/Trustroots/nostroots/releases/)**

> **Note:** These APKs receive over-the-air updates for minor changes, so the date shown in the app's settings screen (after enabling dev mode) may be more recent than the release date.

### iOS

We will probably have an iOS TestFlight available [November 2025](https://github.com/Trustroots/nostroots/issues/116).

---

## Why are we doing this?

### The Problem with Centralized Networks

Hospitality Club was the biggest hospex network in 2004, but it depended on one person and was down for large parts of 2023. CouchSurfing™ sold out to venture capital. Several other networks are based on proprietary software and/or charge money to be a member. As networks grow, there's a tendency to develop bureaucracies and budgets, which eventually lead to negative side effects such as:

- Usage fees
- Monetization of user data
- Over-reliance on donations
- Single points of failure

### Our Vision

We believe it's worth our time and energy to work towards gift economy social networks that do not rely on any specific person or organization—effectively, we want to make ourselves redundant.

The **Nostr protocol** is a decentralized, open network for social networking and messaging, using cryptographic keys for identity verification. This enables:

- **True data ownership:** Users own their data and can choose where to store it
- **Portability:** Your data and connections move with you
- **Innovation:** Easy to build new services on top of existing data
- **Resilience:** No single point of failure

### The Current Landscape

It's great that there are now hospex networks running on open source free software that are free to use, including:

- **Trustroots** (us!)
- [BeWelcome](https://www.bewelcome.org/)
- [Couchers.org](https://www.couchers.org/)

### What's Missing

What's missing is more space for innovation and taking the gift economy into new directions. Think:

- Bicycle sharing
- Access to awesome parties
- Ride shares
- Community organizing
- Local resource sharing

Enabling Nostr on Trustroots will make it way easier for people with ideas to get started, just like Trustroots was kickstarted from Hitchwiki, but in a much smoother way. The user's data _and_ their connections become portable, so that projects like [Trip Hopping](https://www.triphopping.com/) can immediately be useful, even if you are the only user.

Nostroots adds new features to Trustroots through the Nostr protocol, initially replacing the little-used meet functionality. Users can:

- Post notes on pluscode areas of a map
- Subscribe to specific pluscode areas (coming soon)
- Connect notes to specific [circles](https://www.trustroots.org/circles) (coming soon)

This creates a foundation for decentralized, user-owned social networking within the Trustroots ecosystem, enabling innovation in gift economy applications beyond traditional hospitality exchange.

---

## Frequently Asked Questions

> 💡 **You're warmly invited to edit this section:** improve, add questions, and answers!

### Technology & Protocol

#### How is Nostr different?

**Data Ownership:** In Nostr, users own their data. They can choose where to store it and which Nostr clients to use for interaction. This is in stark contrast to e.g. CouchSurfing™, where the company owns and controls user data, including its usage and monetization.

**Decentralization:** Unlike all existing hospitality networks, which are controlled by a single company or organization, Nostr is decentralized. It doesn't rely on a central server or entity. Instead, it operates through a network of independent servers (relays), allowing for greater resistance to censorship and central control.

**Identity Verification:** Nostr uses cryptographic keys for identity verification. Each user has a unique pair of keys (public and private) for identity and authentication, contrasting with reliance on user-provided information like email or phone number that is used on almost all existing networks.

#### ActivityPub, Solid vs Nostr

ActivityPub heavily relies on specific domains and sysadmins running servers. Solid is similar, but the protocol is kind of W3C-bloat. And there's no good profile portability. So if your favorite ActivityPub/Solid hospex network goes rogue and you want to move elsewhere, you're out of luck.

> **Note:** [mostr](https://gitlab.com/soapbox-pub/mostr) is a project to bridge ActivityPub and Nostr.

#### Bluesky vs Nostr

We didn't dive deep into Bluesky, but Cory Doctorow [wrote this](https://pluralistic.net/2024/11/02/ulysses-pact/#tie-yourself-to-a-federated-mast) about it:

> Bluesky lacks the one federated feature that is absolutely necessary for me to trust it: the ability to leave Bluesky and go to another host and continue to talk to the people I've entered into community with there. While there are many independently maintained servers that provide services to Bluesky and its users, there is only one Bluesky server. A federation of multiple servers, each a peer to the other, has been on Bluesky's roadmap for as long as I've been following it, but they haven't (yet) delivered it.

We also spoke to [Rabble](https://primal.net/rabble) in person, and he brought up that the protocol itself is decided upon by Bluesky in a very centralized way, focused on cloning X/Twitter, whereas Nostr NIPs (Nostr Improvement Proposals) are created by a wide range of people building various different applications.
Here's a good presentation by Rabble, [The Revolution will be Social](https://www.youtube.com/watch?v=JGwzlpiFh-8).

#### Tokens, DAO, blockchain, other scams?

**⚠️ If you see "nostr token", run away—it is a scam.**

There's no nostr token. There was no nostr ICO, nostr is not a DAO, there is no blockchain. Nostr makes it easy to integrate Bitcoin Lightning, which may at some point be helpful to, for example, keep out spammers. But this is not something we are interested in for the foreseeable future.

### Development & Strategy

#### Are you sure adopting new web technologies is a good idea for user experience?

> "I've seen the sleepy.bike prototype from [OpenHospitalityNetwork](https://github.com/OpenHospitalityNetwork) using Solid and I really think it's too much to expect from users to use decentralized web for now. I know even I would be reluctant on creating some 'new tech account' just to use some hospitality website."

Generally, we want to see an explosion of gift economy ideas… and all kinds of remixes of ideas around geo data, meeting people, and organizing events. Trustroots is good at hospitality, so for the foreseeable future we will keep this working as is.

But the meet functionality was hardly used by anyone, and there is a lot of untapped potential around circles, and connecting this to, for example, Hitchwiki and maps. We want to try to add Nostr functionality in this direction, without breaking the hospitality part, and in a way that it's easy for anyone to try to use or even build new things if they choose to.

#### Why are you building an app?

Most of our users are travelers accessing the site from their phone. We think that UX with Nostr and self-managed keys will be challenging in the best of cases. We need the added functionalities of a native app to make the whole process acceptably smooth. Native apps provide:

- Better notification services
- Better location access
- More reliable private key storage and backup
- Better interaction with other apps (e.g., for the purpose of logging in with a different app)
- An overall smoother experience

Users almost universally prefer apps over mobile websites. Choosing to build one is putting their interests over the interests of the developers.

#### How is this decentralized? Aren't you still controlling access?

In an ideal world, we'd just move Trustroots data onto Nostr, tell all our users to generate and store their private keys, and watch the beautiful decentralization blossom. In this world, that plan doesn't work. Users will forget their keys, not understand what's going on, and be left frustrated by the experience. A perfect decentralization that's unused does not actually achieve any of our goals.

We believe that we need to slowly introduce the idea of owning your own identity and introduce new possibilities on top of this, making sure that at any step along the way the excitement is bigger than the frustration. To this end, we will:

1. Start by offering users to maintain their private keys for them
2. Let them experience using the Trustroots app to interact with other parts of the Nostr ecosystem in ways that we sufficiently control to make sure their experience is pleasant
3. As the Nostr ecosystem develops, nudge them towards storing their identity in some other way and accessing Trustroots with that identity the same way they used their Trustroots-stored identity for other services in the past

Similarly, we will initially do a lot of curating about what content is shown to users and slowly encourage them to place their own filters.

#### Why aren't you working with existing Nostr kinds more?

We believe that the main benefit of Nostr comes from owning your data through owning your identity and the publicly-by-default nature of how that data is stored, making it easy to build services on top of existing data. We don't think that being able to easily pull in data from a different service type (e.g., a social media app) and display it in your own service is a big advantage. In fact, it's likely to cause a worse user experience because the pulled-in data doesn't quite match the style and vibe of the service that's doing the pulling.

On top of this, using kinds that are controlled by someone else or a NIP severely reduces the innovation speed, and easy innovation is the most valuable aspect of the Nostr ecosystem right now.

### Community & Culture

#### BeWelcome, Couchers.org?

It would be great to at some point connect with BeWelcome and Couchers over Nostr. We're working on building these connections.

#### How is this going to be appealing for hosts?

A lot of our roadmap is focused on the surfer experience. They'll be motivated to try out new tech because they're trying to have a good trip. Hosts, however, have no such incentive. But they're the life of the community!

To reach them, we will have to focus on old-fashioned community work. We believe that hosts are the most committed to the values of sharing and gifting and will appreciate getting to know people or feeling connected with other people who share those values outside of the hospitality exchange sphere of things.

#### Is nostr a good culture fit for Trustroots?

[See this GitHub issue for discussion](https://github.com/Trustroots/nostroots/issues/26)

It's true that in 2025 there's a lot of content on nostr that could be considered far from Trustroots values. To be clear, we're choosing nostr as a **technology** and not as a social landscape. We're seeking Trustroots-adjacent content on nostr and we have already come across some great stuff:

- **[nos.social](https://nos.social/)** is an app that gives a view on the nostr social media that aligns a bit more with Trustroots culture (iOS only)
- **[Satellite.earth](https://satellite.earth)** gives a Reddit-like view on nostr social media posts, with some nice communities such as:
  - [FOSS](https://satellite.earth/n/FOSS/npub1z786cz3za6h4zw42ju5j7l8uxh9g4xrks93jjx9pmxpkh8py59jqszu2dz)
  - [Gardening](https://satellite.earth/n/Gardening/npub1kemda478drtx5at65wt8kyjrmy9l27hmp8gsgnfjr8vdgf8y46sqsw0hnv)
  - [Vegan Consciousness](https://satellite.earth/n/Vegan_Consciousness/npub1c6dhrhzkflwr2zkdmlujnujawgp2c9rsep6gscyt6mvcusnt5a3srnzmx3)
  - [MusicCommunity](https://satellite.earth/n/MusicCommunity/npub1njst6azswskk5gp3ns8r6nr8nj0qg65acu8gaa2u9yz7yszjxs9s6k7fqx)
- **[protest.net](https://protest.net/)** is moving to nostr

And by decentralizing Trustroots, hitchhikers, and circles, we can be a big, growing part of the decentralized nostr ecosystem, spreading and strengthening the vibes that we want to see in the world.

---

## Want to Help?

If you want to help, you can:

- **Try out our app** - Download and test the [Android APK](https://github.com/Trustroots/nostroots/releases/) or [wait](https://github.com/Trustroots/nostroots/issues/116) for the iOS TestFlight
- **Check the issues** - Browse and contribute to issues at the [nostroots repository](https://github.com/Trustroots/nostroots)
- **Learn about Nostr** - Read the [Nostr protocol documentation](https://nostr.com/) to understand the technology
- **Join the conversation** - Chat with us in the [#nostroots Matrix room](https://matrix.to/#/#nostroots:matrix.org)

---

## Resources

- **[Blog posts about Nostr](https://ideas.trustroots.org/category/nostr/)** - Read about our journey and updates
- **[GitHub repository](https://github.com/Trustroots/nostroots)** - Contribute code, report issues, or follow development
- **[Nostr protocol documentation](https://nostr.com/)** - Learn more about the Nostr protocol itself

<div style="margin: 2rem 0; text-align: center;">
<a href="https://hitchwiki.org/en/User:Nostrhitch">
<img src="600px-Nostrhitch.jpg" alt="Nostrhitch Bot" style="max-width: 300px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);" />
</a>
<p style="margin-top: 0.75rem; color: #555; font-size: 0.9rem;">
<strong><a href="https://hitchwiki.org/en/User:Nostrhitch">Nostrhitch</a></strong> is a bot that automatically posts Hitchwiki changes and new Hitchmap spots to Nostr relays, bridging the Hitchwiki community with the decentralized Nostr network. <a href="https://hitchwiki.org/en/User:Nostrhitch">Learn more on the Nostrhitch user page</a>.
</p>
</div>

---

<iframe id="Iframe1" width="100%" height="300" frameborder="0" src="https://tripch.at/embed.html" style="margin-top: 2rem; border-radius: 4px;"></iframe>
