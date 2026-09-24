# Design

The lookup endpoint accepts a username and returns the member plus the members
found in `Message.userTo` for messages sent by that member. The send endpoint
accepts the username and warning content, repeats the lookup server-side, and
creates one normal message and thread upsert per recipient. Existing message
HTML sanitisation is reused. The UI only enables sending after a successful
preview and requires non-empty content.
