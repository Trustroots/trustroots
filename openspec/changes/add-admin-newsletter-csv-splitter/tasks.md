# Tasks

## 1. Newsletter splitting API

- [ ] 1.1 Add an admin-only CSV upload endpoint for newsletter reconciliation
- [ ] 1.2 Parse uploaded CSV emails and classify each as subscribed or unsubscribed
- [ ] 1.3 Return two generated CSV outputs and summary counts
- [ ] 1.4 Keep admin authorisation and audit-log middleware coverage

## 2. Admin newsletter UI

- [ ] 2.1 Replace placeholder newsletter page with upload form and progress/error states
- [ ] 2.2 Provide two CSV download actions from API results
- [ ] 2.3 Show a short classification summary for uploaded records

## 3. Verification

- [ ] 3.1 Add/update server controller and route tests for the new endpoint
- [ ] 3.2 Add/update client component and API tests for upload and download flows
- [ ] 3.3 Add or update end-to-end coverage for newsletter CSV splitting
- [ ] 3.4 Keep client/server coverage at 100% and preserve e2e baseline expectations
