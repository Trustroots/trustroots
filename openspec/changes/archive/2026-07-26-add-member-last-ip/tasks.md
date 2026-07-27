## 1. Member activity recording

- [x] 1.1 Add an indexed optional current-IP field to member records
- [x] 1.2 Update the field with the existing rate-limited authenticated
      last-seen write, using the trusted client address source
- [x] 1.3 Restore Cloudflare visitor addresses in Nginx only for trusted
      Cloudflare proxy networks before Passenger handles the request

## 2. Administration

- [x] 2.1 Include the IP address in administrator member search results and
      member reports
- [x] 2.2 Add an administrator-only exact-IP lookup and link each displayed IP
      address to its matching members

## 3. Privacy and verification

- [x] 3.1 State collection, moderation purpose, administrator access, and
      account-deletion retention in the privacy policy
- [x] 3.2 Add server, client, and end-to-end coverage
- [x] 3.3 Validate, archive, and merge the OpenSpec change into the living spec
