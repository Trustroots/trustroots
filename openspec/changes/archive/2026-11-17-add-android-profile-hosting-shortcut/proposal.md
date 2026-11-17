# Add an Android profile hosting shortcut

## Why

Members should be able to edit hosting directly from their own profile (Refs #3683).

## What changes

- Show Edit hosting beneath Edit your profile on the signed-in member's profile.
- Open the existing native hosting editor in a saved profile navigation entry.
- Hide the shortcut on other members' profiles.

## Impact

Android profile UI and navigation only. Existing hosting endpoints, session handling and unsaved-change guards are reused. No data migration or deployment changes.
