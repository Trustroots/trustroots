## Decisions

- Confirm deletion separately from removing a note from the homepage. Use a NIP-07 signer matching the note's author to publish a kind 5 event with the original event ID and kind tags.
- After a relay acknowledges the event, send the signed event to Trustroots. Verify its signature and author against the stored note before recording deletion.
- Store only the original note metadata and the deletion event ID after deletion. Keep metadata when merely unfeaturing a note so a concurrent deletion request can still be verified. A deleted note cannot be re-featured.
