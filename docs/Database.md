# Trustroots Database

_TODO: Move to code using http://usejsdoc.org/ format._

## Users

- **\_id**
- **tagline** (string)
- **firstName** (string)
- **lastName** (string)
- **displayName** (**firstName** + **lastName**)
- **username** (required, unique)
- **email** (required, unique)
- **emailHash** (md5(**email**)) — _used for example with [Gravatar](http://en.gravatar.com/)_
- **emailTemporary** (string) - new email is stored here until it is confirmed
- **emailToken** (string) - for confirming email changes
- **public** (boolean) - if user's profile should be publicly visible (false until first email confirm)
- **description** (string)
- **birthdate** (date)
- **gender** (male,female,other)
- **languages** ([])
- **locationLiving** (string) — _likely to change to Geonames object later on_
- **locationFrom** (string) — _same as above_
- **password** (string)
- **salt** (string)
- **provider** — _via [Passport](http://passportjs.org/)_
- **providerData** — _via [Passport](http://passportjs.org/)_
- **additionalProvidersData**
- **roles** ([user, admin])
- **seen** (date)
- **updated** (date) — _when any of this info was updated via profile update controller_
- **created** (date) — _registration_
- **avatarSource** (none|gravatar|facebook|local)
- **newsletter**
- **resetPasswordToken**
- **resetPasswordExpires** (date)

## References

- **\_id**
- **[user](#users)** (\_id)

## Contacts

_Likely to change into array of user ids at some point._

- **\_id**
- **[userA](#users)** (\_id)
- **[userB](#users)** (\_id)

## Offers

- **\_id**
- **type** [hosting,meet] — _in future also other types?_
- **[user](#users)** (\_id)
- **status** (yes|maybe|no)
- **description** (string)
- **noOfferDescription** (string) — _used when **status** is "no"_
- **maxGuests** (int)
- **updated** (date)
- **location** ([lat,lng])
- **locationFuzzy** ([lat,lng])

## Threads

_Much of a cache table for [Message](#messages)_

- **\_id**
- **[participant1](#users)** (\_id)
- **[participant2](#users)** (\_id)
- **[message](#messages)** (\_id)

## Messages

- **\_id**
- **[userFrom](#users)** (\_id)
- **[userTo](#users)** (\_id)
- **content** (string)
- **created** (date)
- **read** (boolean) — _if **userTo** has seen the message._

## Sessions

_[Passport](http://passportjs.org/) stuff._

- **\_id**
- **session** (json)
- **expires** (date)
