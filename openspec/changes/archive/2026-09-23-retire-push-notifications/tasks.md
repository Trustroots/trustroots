## 1. Remove push delivery stack

- [x] 1.1 Remove Expo and Firebase packages, adapters, and FCM config wiring
- [x] 1.2 Remove service-worker build entry and browser registration
- [x] 1.3 Remove Agenda push job registration and push service helpers

## 2. Retire registration and callers

- [x] 2.1 Reject new push registrations; keep removal and historical schema values
- [x] 2.2 Remove push side-effects from messaging, experiences, and statistics
- [x] 2.3 Update server, client, and end-to-end tests for the retired behaviour
