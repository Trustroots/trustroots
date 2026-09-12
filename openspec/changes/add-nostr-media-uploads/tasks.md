- [ ] Agree the first supported image use cases: avatar, profile photo, and/or
      travel photo.
- [ ] Select a small Blossom-compatible media server and document its
      persistent storage, backup, shared ownership, and moderation requirements.
- [ ] Define separate media reference and blob records, including ownership,
      visibility, pending deletion, and moderation states.
- [ ] Define the Nostr event kind, tags, and `imeta` fields for shared media.
- [ ] Add a server-side media adapter with upload, retrieval, and deletion
      operations.
- [ ] Coordinate reference creation and deletion per blob, retain blobs with
      active references or other owners, and recheck retention before retries.
- [ ] Add authorised blob-wide takedowns that block new uploads and all
      Trustroots-controlled serving routes, derivatives, and cached copies.
- [ ] Preserve the existing upload limits, MIME checks, image validation, and
      derivative behaviour.
- [ ] Add a persistent deployment volume and verify application releases do
      not remove uploaded media.
- [ ] Add server and client tests for the media flow and moderation behaviour.
- [ ] Cover shared uploads across members and purposes, unauthorised removal,
      final-reference deletion, concurrent uploads, deletion retries, and
      blob-wide takedowns against the member-media scenarios.
- [ ] Add an end-to-end test covering a member upload and display.
- [ ] Migrate existing avatar and circle files only after the new path is
      operational and backed up.
