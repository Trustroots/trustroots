- [ ] Agree the first supported image use cases: avatar, profile photo, and/or
      travel photo.
- [ ] Select a small Blossom-compatible media server and document its
      persistent storage and backup requirements.
- [ ] Define the Trustroots media record and ownership/moderation states.
- [ ] Define the Nostr event kind, tags, and `imeta` fields for shared media.
- [ ] Add a server-side media adapter with upload, retrieval, and deletion
      operations.
- [ ] Preserve the existing upload limits, MIME checks, image validation, and
      derivative behaviour.
- [ ] Add a persistent deployment volume and verify application releases do
      not remove uploaded media.
- [ ] Add server and client tests for the media flow and moderation behaviour.
- [ ] Add an end-to-end test covering a member upload and display.
- [ ] Migrate existing avatar and circle files only after the new path is
      operational and backed up.
