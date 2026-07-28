# Tasks

## 1. Eligibility hardening

- [ ] 1.1 Define a shared "can receive newsletter emails" rule in admin newsletter logic
- [ ] 1.2 Exclude suspended, shadowbanned, and deletion-pending accounts from eligible exports
- [ ] 1.3 Apply the same eligibility rule to CSV split classification

## 2. Export endpoints and UI

- [ ] 2.1 Add/enable admin API for exporting all eligible subscribers as CSV
- [ ] 2.2 Add/enable admin API for exporting eligible subscribers for a specific circle
- [ ] 2.3 Add newsletter-page controls for full export and circle export downloads

## 3. Verification

- [ ] 3.1 Update server controller and route tests for eligibility and new exports
- [ ] 3.2 Update client API/component tests for export interactions
- [ ] 3.3 Update e2e coverage and feature map scenarios for export tooling
