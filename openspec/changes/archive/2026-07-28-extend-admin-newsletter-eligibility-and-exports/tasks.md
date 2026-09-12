# Tasks

## 1. Eligibility hardening

- [x] 1.1 Define a shared "can receive newsletter emails" rule in admin newsletter logic
- [x] 1.2 Exclude suspended, shadowbanned, and deletion-pending accounts from eligible exports
- [x] 1.3 Apply the same eligibility rule to CSV split classification

## 2. Export endpoints and UI

- [x] 2.1 Add/enable admin API for exporting all eligible subscribers as CSV
- [x] 2.2 Add/enable admin API for exporting eligible subscribers for a specific circle
- [x] 2.3 Add newsletter-page controls for full export and circle export downloads

## 3. Verification

- [x] 3.1 Update server controller and route tests for eligibility and new exports
- [x] 3.2 Update client API/component tests for export interactions
- [x] 3.3 Update e2e coverage and feature map scenarios for export tooling
