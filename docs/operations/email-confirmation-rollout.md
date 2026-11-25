# Email confirmation link rollout

New signup, manual resend and email-change links expire after 24 hours.
Automatic signup reminder links expire after 72 hours. Reminders are eligible
again after 48 hours, giving the worker a day to send the next email before the
previous link expires. A reminder replaces the previous link and counts towards
the reminder limit after the mail server accepts it. If delivery fails, the
previous link keeps its original expiry and the reminder remains eligible.

Links issued before expiry metadata existed were accepted until 1 November 2026
at 00:00 UTC. The cut-off is fixed in the application. During rollout, verify
that every web instance is running a release with that cut-off. Once the rollout
is confirmed and the rollback window for older releases has closed, remove the
legacy-token branch and its cut-off constant in the next release.

Members can sign in and open **Profile → Edit profile → Account** to select
**Resend confirmation**, even after their final signup reminder has expired.
Members with an existing public profile can also choose **Cancel email change**
to keep their current address. For a signup with an inaccessible address, the
member can enter an address they can access and select **Change email**.
