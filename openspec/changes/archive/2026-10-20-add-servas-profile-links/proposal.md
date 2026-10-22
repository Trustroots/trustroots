## Why

Members cannot currently link their Servas profile from the dedicated hospitality network fields (issue #2803).

## What Changes

- Add an optional Servas profile path to the network editor and profile sidebar.
- Support `household/…` and `address/…` paths under `https://servas.org/`.
- Apply existing external contact visibility rules to this field.

## Impact

Only the users module and profile tests change. The optional database field needs no migration; existing profiles behave as before. No new dependencies or module links are required.
