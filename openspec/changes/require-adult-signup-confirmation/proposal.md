# Require adult signup confirmation

Trustroots membership is limited to people aged 18 or older, but the public rules and signup form do not state this requirement.

Update the pages and users modules to explain the requirement and require an unticked age confirmation checkbox. The signup API will require literal `ageConfirmed: true` before account creation or email delivery. This declaration is not stored and no birthdate is collected. Existing accounts are unaffected; deploy client and server together because older clients will receive an explanatory HTTP 400 response.
