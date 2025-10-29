# Nostroots

We're working on adding new features to Trustroots thru the Nostr protocol.

Initially this is a replacement of the little used meet functionality:
Users can post notes on pluscode area of a map and soon subscribe to specific pluscode areas. Later these notes can also be related to specific 
[circles](https://www.trustroots.org/circles).

If you're adventurous there's an APK you can try on your android phone.

## Android

<a href="https://github.com/Trustroots/nostroots/releases/">APK releases at github</a>

These APKs get over-the-air updates for minor things, so the date that shows in the app's settings screen (after enabling dev mode) is probably more recent than this.


## iOS

We will have an iOS testflight available when the [expo map component is more stable](https://github.com/Trustroots/nostroots/issues/92).





## Background

Hospitality Club was the biggest hospex network in 2004, depended on one person, website down for large parts of 2023. CouchSurfing(tm) sold out to venture capital. Several other networks are based on proprietary software and/or charge money to be a member. As networks grow there is a tendency to grow bureaucracies and budgets, which eventually lead to negative side effects such as usage fees, monetization of user data or too much reliance on donations.

We think it is worth our time and energy to work towards gift economy social networks that do not rely on any specific person or organization, so effectively we want to make ourselves redundant.

The Nostr protocol is a decentralized, open network for social networking and messaging, using cryptographic keys for identity verification.

It is great there are now hospex networks running on open source free software that are free to use, apart from Trustroots there are also [BeWelcome](https://www.bewelcome.org/) and [Couchers.org](https://www.couchers.org/).

What is missing is more space for innovation and taking the gift economy into new directions. Think bicycle sharing, access to awesome parties, ride shares. Enabling Nostr on Trustroots will make it way easier for people with ideas to start off with a kickstart, just like Trustroots was kickstarted off Hitchwiki, but in a much smoother way. The user's data _and_ their connections become portable, so that projects like [Trip Hopping](https://www.triphopping.com/) can immediately be useful, even if you are the only user.

## FAQ

_you're warmly invited to edit this: improve, add questions, answers_

### How is Nostr different?

**Data Ownership:** In Nostr, users own their data. They can choose where to store it and which Nostr clients to use for interaction. This is in stark contrast to e.g. CouchSurfing(tm), where the company owns and controls user data, including its usage and monetization.

**Decentralization:** Unlike all existing hospitality networks, which are controlled by a single company or organization, Nostr is decentralized. It doesn't rely on a central server or entity. Instead, it operates through a network of independent servers, allowing for greater resistance to censorship and central control.

**Identity Verification:** Nostr uses cryptographic keys for identity verification. Each user has a unique pair of keys (public and private) for identity and authentication, contrasting with reliance on user-provided information like email or phone number that is used on almost all existing networks.


### Are you sure adopting new web technologies is a good idea for user experience?

"I've seen the sleepy.bike prototype from [OpenHospitalityNetwork](https://github.com/OpenHospitalityNetwork) using Solid and I really think it's too much to expect from users to use decentralized web for now. I know even I would be reluctant on creating some "new tech account" just to use some hospitality website."

Generally we want to see an explosion of gift economy ideas… and all kinds of remixes of ideas around geo data, meeting people and organizing events. Trustroots is good at hospitality, so for the foreseeable future we will keep this working as is. But the meet functionality was hardly used by anyone, and there is a lot of untapped potential around circles, and connecting this to for example Hitchwiki and maps. We want to try to add Nostr functionality in this direction, without breaking the hospitality part, and in a way that it's easy for anyone to try to use or even build new things if they choose to.

### ActivityPub, Solid vs Nostr

ActivityPub heavily relies on specific domains and sysadmins running servers. Solid is similar, but the protocol is kinda W3C-bloat. And there's no good profile portability. So if your favorite ActivityPub/Solid hospex network goes rogue and you want to move elsewhere you are out of luck.

Note that https://gitlab.com/soapbox-pub/mostr is a project to bridge ActivityPub and Nostr.

### Bluesky vs Nostr

We didn't dive into Bluesky but Cory Doctorow [wrote this](https://pluralistic.net/2024/11/02/ulysses-pact/#tie-yourself-to-a-federated-mast) about it:

> Bluesky lacks the one federated feature that is absolutely necessary for me to trust it: the ability to leave Bluesky and go to another host and continue to talk to the people I've entered into community with there. While there are many independently maintained servers that provide services to Bluesky and its users, there is only one Bluesky server. A federation of multiple servers, each a peer to the other, has been on Bluesky's roadmap for as long as I've been following it, but they haven't (yet) delivered it.

We also spoke to [Rabble](https://primal.net/rabble) in person and he brought up that the protocol itself is decided upon by Bluesky
in a very centralized way, focused on cloning X/Twitter, whereas Nostr NIPs are created by a wide range
of people building various different applications. 

### BeWelcome, couchers.org?

It would be great to at some point connect with BW and Couchers over Nostr. We're working on building these connections.

### tokens, dao, blockchain, other scams?

If you see "nostr token", run away, it is a scam. There's no nostr token. There was no nostr ICO, nostr is not a DAO, there is no blockchain. Nostr makes it easy to integrate bitcoin lightning, which may at some point be helpful to for example keep out spammers. But this is not something we are interested in for the foreseeable future.

### Why are you building an app?

Most of our users are travellers accessing the site from their phone. We think that UX with Nostr and self-managd keys will be challenging in the best of cases. We need the added functionalities of a native app to make the whole process accpeptably smooth. Native apps provide for better notification services, better location access, more reliable private key storage and backup, better interaction with other apps (e.g. for the purpose of logging in with a different app) and an overall smoother experience. Users almost universally prefer apps over mobile websites. Choosing to build one is putting their interests over the interests of the developers.

### How is this decentralized? Aren't you still controlling access?

In an ideal world, we'd just move Trustroots data onto Nostr, tell all our users to generate and store their private keys, and watch the beautiful decentralistion blossom. In this world, that plan doesn't work. Users will forget their keys, not understand what's going on, and be left frustrated by the experience. A perfect decentralisation that's unused does not actually achieve any of our goals.

We believe that we need to slowly introduce the idea of owning your own identity and introduce new possibilities on top of this, making sure that at any step along the way the excitement is bigger than the frustration. To this end, we will start by offering the users to maintain their private keys for them.  They can experience using the Trustroots app to interact with other parts of the Nostr ecosystem in ways that we sufficiently own to make sure their pleasant. Then, as the Nostr ecosystem develops, we will nudge them towards storing their identity in some other way and accessing Trustroots with that identity the same way they used their Trustroots-stored identity for other services in the past.

Similarly, we will initially do a lot of curating about what content is shown to users and slowly encourage them to place their own filters.

### How is this going to be appealing for hosts?

A lot of our roadmap is focused on the surfer experience. They'll be motivated to try out new tech because they're trying to have a good trip. Hosts, however, have no such incentive. But they're the life of the community! To reach them, we will have to focus on old-fashioned community work. We believe that hosts are the most committed to the values of sharing and gifting and will appreciate getting to know people or feeling connected with other people who share those values outside of the hospitality exchange sphere of things.

### Why aren't you working with existing Nostr kinds more?

We believe that the main benefit of Nostr comes from owning your data through owning your identity and the publicy-by-default nature of how that data is stored, making it easy to build services on top of existing data. We don't think that being able to easily pull in data from a different service type (e.g. a social media app) and display it in your own service is a big advantage. In fact, it's likely to cause a worse user experience because the pulled-in data doesn't quite match the style and vibe of the service that's doing the pulling. On top of this, using kinds that are controlled by someone else or a NIP severely reduces the innovation speed, and easy innovation is the most valuable aspet of the Nostr ecosystem right now.

### [Is nostr a good culture fit for Trustroots?](https://github.com/Trustroots/nostroots/issues/26)

It's true that in 2025 there's a lot of content on nostr that could be considered far from trustroots values. To be clear, we're choosing nostr as a technology and not as a social landscape. We're seeking trustroots adjacent content on nostr and we have already come across some great stuff:

- [nos.social](https://nos.social/) is an app that gives a view on the nostr social media that aligns a bit more with Trustroots culture, only for iOS though.
- [Satellite.earth](https://satellite.earth) gives a reddit-like view on nostr social media posts, with some nice communities such as [FOSS](https://satellite.earth/n/FOSS/npub1z786cz3za6h4zw42ju5j7l8uxh9g4xrks93jjx9pmxpkh8py59jqszu2dz), [Gardening](https://satellite.earth/n/Gardening/npub1kemda478drtx5at65wt8kyjrmy9l27hmp8gsgnfjr8vdgf8y46sqsw0hnv), [Vegan Consciousness](https://satellite.earth/n/Vegan_Consciousness/npub1c6dhrhzkflwr2zkdmlujnujawgp2c9rsep6gscyt6mvcusnt5a3srnzmx3) and [MusicCommunity](https://satellite.earth/n/MusicCommunity/npub1njst6azswskk5gp3ns8r6nr8nj0qg65acu8gaa2u9yz7yszjxs9s6k7fqx)
- [protest.net](https://protest.net/) is moving to nostr

And by decentralizing trustroots, hitchhikers and circles, we can be a big, growing part of the decentralized nostr ecosystem, spreading and strengthening the vibes that we want to see in the world.

## More information

* [blog posts](https://ideas.trustroots.org/category/nostr/)
* [github repo](https://github.com/Trustroots/nostroots)
