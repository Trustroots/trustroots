# Exclude countries from hackerspace imports

## Why

The requested admin policy excludes hackerspaces identified as being in Russia or Israel from new publication and requests deletion of existing listings.

## What changes

- Recognise country names/codes in structured and legacy addresses in the admin importer.
- Skip new excluded listings and prepare NIP-09 kind 5 deletion requests for existing listings, including all discovered authors.
- Require the signing key to match the original author; publish requests to both configured relays and report failures.
- Group Hackerspaces under Circles in admin navigation. Leave public map parsing unchanged.
- Provide sortable preview columns and six focused admin navigation groups.
- Show the connected signer's npub and matching trustroots.org identity from MongoDB before signing, with per-event author matching and key-change protection.

## Impact

Changes admin client code and adds an administrator-only identity lookup endpoint using the existing indexed npub field. No database migration. The lookup uses the same public account eligibility rules as the existing NIP-05 endpoint. Deletion requests cannot guarantee removal from every relay or cached client. Addresses without country information remain eligible under existing rules.
